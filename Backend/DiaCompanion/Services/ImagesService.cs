using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-22, UC-23, UC-24, UC-26 — ảnh đáy mắt.</summary>
public class ImagesService : BaseService, IImagesService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IVoidService _void;
    private readonly IFileStorageService _storage;

    public ImagesService(IRepository repository, ICurrentUser me, IAuditService audit,
                            IVoidService voidSvc, IFileStorageService storage)
    { _repository = repository; _me = me; _audit = audit; _void = voidSvc; _storage = storage; }
    public async Task<ActionResult<List<FundusImageDto>>> List(
        [FromQuery] int? patientId, [FromQuery] int? visitId)
    {
        if (patientId is null && visitId is null)
            throw AppException.BadRequest(Msg.RequiredFields, "Cần chỉ định patientId hoặc visitId.");

        var query = _repository.FundusImages.AsNoTracking();
        if (patientId is int pid) query = query.Where(f => f.PatientId == pid);
        if (visitId is int vid) query = query.Where(f => f.VisitId == vid);

        var items = await query.OrderBy(f => f.Eye).ThenByDescending(f => f.CreatedAt)
            .Select(f => new FundusImageDto
            {
                Id = f.Id,
                PatientId = f.PatientId,
                VisitId = f.VisitId,
                Eye = (byte)f.Eye,
                QualityStatus = (byte)f.QualityStatus,
                QualityNote = f.QualityNote,
                CreatedAt = f.CreatedAt,
                ContentUrl = $"/api/images/{f.Id}/content"
            }).ToListAsync();

        return Ok(items);
    }

    /// <summary>UC-22 — nạp ảnh đáy mắt.</summary>
    [RequestSizeLimit(12 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<FundusImageDto>> Upload([FromForm] UploadFundusRequest req)
    {
        var file = req.File;
        var patientId = req.PatientId;
        var visitId = req.VisitId;
        var eye = req.Eye;


        var visit = await _repository.Visits
    .FirstOrDefaultAsync(v =>
        v.Id == req.VisitId &&
        v.PatientId == req.PatientId);

        if (visit is null)
            throw AppException.BadRequest(Msg.RequiredFields, "Vui lòng chọn lượt khám của bệnh nhân.");

        if (file is null || file.Length == 0)
            throw AppException.BadRequest(Msg.RequiredFields, "Vui lòng chọn tệp ảnh.");


        if (visit.Status != VisitStatus.InProgress)
            throw AppException.Conflict(Msg.PatientNotFound, "Không thể tải ảnh vào lượt khám đã đóng.");

        var patient = await _repository.Patients.FirstOrDefaultAsync(p => p.Id == patientId)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");

        if (visitId is int vid && !await _repository.Visits.AnyAsync(v => v.Id == vid && v.PatientId == patientId))
            throw AppException.BadRequest(Msg.RequiredFields, "Lượt khám không thuộc bệnh nhân này.");

        await using var stream = file.OpenReadStream();
        var stored = await _storage.SaveFundusAsync(stream, file.FileName, patient.Code, visitId);

        var image = new FundusImage
        {
            PatientId = patientId,
            VisitId = visitId,
            Eye = eye,
            FilePath = stored.RelativePath,
            FileSha256 = stored.Sha256,
            SizeBytes = (int)stored.SizeBytes,
            // BR-01: mọi ảnh vào hệ thống ở trạng thái Chờ duyệt.
            // Không ảnh nào được chạy AI trước khi có người xác nhận chất lượng.
            QualityStatus = QualityStatus.Pending,
            UploadedBy = _me.RequireId()
        };

        _repository.FundusImages.Add(image);
        await _repository.SaveChangesAsync();

        await _audit.LogAsync(AuditAction.ImageUpload, nameof(FundusImage), image.Id,
            null, new { patientId, visitId, eye = eye.ToString(), sha256 = stored.Sha256 });
        await _repository.SaveChangesAsync();

        return Ok(new FundusImageDto
        {
            Id = image.Id,
            PatientId = image.PatientId,
            VisitId = image.VisitId,
            Eye = (byte)image.Eye,
            QualityStatus = (byte)image.QualityStatus,
            CreatedAt = image.CreatedAt,
            ContentUrl = $"/api/images/{image.Id}/content"
        });
    }

    /// <summary>
    /// UC-26 — phục vụ nội dung ảnh.
    ///
    /// QT-18: file nằm ngoài webroot. Mọi lượt xem đều đi qua đây để kiểm quyền,
    /// thay vì phát tĩnh hay dùng presigned URL của dịch vụ đám mây (hệ thống
    /// triển khai tại chỗ, có thể không có internet).
    /// </summary>
    public async Task<IActionResult> Content(int id)
    {
        var image = await _repository.FundusImages.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy ảnh.");

        // Bệnh nhân chỉ xem được ảnh của chính mình
        EnsureCanAccessPatient(_me, image.PatientId);

        if (!_storage.Exists(image.FilePath))
            throw AppException.NotFound(Msg.LoadFailed, "Tệp ảnh không còn trên hệ thống.");

        var stream = _storage.OpenRead(image.FilePath);
        var contentType = Path.GetExtension(image.FilePath).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            _ => "image/jpeg"
        };
        return File(stream, contentType);
    }

    /// <summary>
    /// UC-23 — kiểm duyệt chất lượng ảnh.
    ///
    /// Cho phép cả Điều dưỡng: người chụp phát hiện ảnh hỏng ngay lúc bệnh nhân
    /// còn ở phòng khám thì chụp lại được; để đến khi bác sĩ duyệt thì bệnh nhân
    /// đã về. Quyết định này khớp ma trận phân quyền SCR-10.
    /// </summary>
    public async Task<IActionResult> SetQuality(int id, QualityCheckRequest req)
    {
        var image = await _repository.FundusImages.FirstOrDefaultAsync(f => f.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy ảnh.");

        if (req.Status == QualityStatus.Ungradable && string.IsNullOrWhiteSpace(req.Note))
            throw AppException.BadRequest(Msg.RequiredFields,
                "Vui lòng nhập lý do khi đánh dấu ảnh không đạt chất lượng.");

        var before = new { status = image.QualityStatus.ToString(), image.QualityNote };

        image.QualityStatus = req.Status;
        image.QualityNote = req.Note?.Trim();
        image.QualityCheckedBy = _me.RequireId();
        image.QualityCheckedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.QualityCheck, nameof(FundusImage), image.Id,
            before, new { status = req.Status.ToString(), note = req.Note });
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Đã cập nhật trạng thái chất lượng ảnh." });
    }

    /// <summary>UC-24 — thu hồi ảnh (lan sang kết quả AI và review của ảnh đó).</summary>
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        await _void.VoidImageAsync(id, req.Reason);
        return Ok(new { message = "Đã thu hồi ảnh và các kết quả liên quan." });
    }
}
