using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-18..21 — lượt khám.</summary>
public class VisitsService : BaseService, IVisitsService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IVoidService _void;
    private readonly IConfigService _cfg;
    private readonly INotificationService _notify;

    public VisitsService(IRepository repository, ICurrentUser me, IAuditService audit,
                            IVoidService voidSvc, IConfigService cfg, INotificationService notify)
    { _repository = repository; _me = me; _audit = audit; _void = voidSvc; _cfg = cfg; _notify = notify; }

    /// <summary>Danh sách lượt khám của một bệnh nhân.</summary>
    public async Task<ActionResult<PagedResult<VisitDto>>> List(
        [FromQuery] int? patientId, [FromQuery] byte? status, [FromQuery] PageQuery page)
    {
        var query = _repository.Visits.AsNoTracking();
        if (patientId is int pid) query = query.Where(v => v.PatientId == pid);
        if (status is byte st) query = query.Where(v => (byte)v.Status == st);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(v => v.VisitDate)
            .Skip(page.Skip).Take(page.PageSize)
            .Select(MapVisit).ToListAsync();

        return Ok(new PagedResult<VisitDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }

    /// <summary>UC-19 — chi tiết lượt khám kèm ảnh, kết quả AI và review.</summary>
    public async Task<ActionResult<VisitDto>> Get(int id)
    {
        var v = await _repository.Visits.AsNoTracking().Where(x => x.Id == id).Select(MapVisit)
            .FirstOrDefaultAsync()
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");
        return Ok(v);
    }

    /// <summary>UC-18 — tạo lượt khám.</summary>
    public async Task<ActionResult<VisitDto>> Create(CreateVisitRequest req)
    {
        if (!await _repository.Patients.AnyAsync(p => p.Id == req.PatientId))
            throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");

        var visit = new Visit
        {
            PatientId = req.PatientId,
            // Nếu người tạo là bác sĩ thì mặc định họ phụ trách lượt khám này
            DoctorId = req.DoctorId ?? (_me.Role == UserRole.Doctor ? _me.Id : null),
            VisitDate = DateTime.UtcNow,
            Status = VisitStatus.InProgress
        };

        _repository.Visits.Add(visit);
        await _repository.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = visit.Id }, await GetDtoAsync(visit.Id));
    }

    /// <summary>
    /// UC-20 — nhập kết luận và đóng lượt khám.
    /// BR-12: bắt buộc có kết luận. BR-19: chu kỳ tái khám suy từ mức DR đã xác nhận.
    /// </summary>
    public async Task<ActionResult<VisitDto>> Close(int id, CloseVisitRequest req)
    {
        var v = await _repository.Visits.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");

        if (v.Status == VisitStatus.Completed)
            throw AppException.BadRequest(Msg.ApptImmutable, "Lượt khám đã được đóng.");

        if (string.IsNullOrWhiteSpace(req.Conclusion))
            throw AppException.BadRequest(Msg.ConclusionNeeded, "Chưa nhập kết luận nên không thể đóng lượt khám.");

        // Mọi kết quả AI trong lượt khám phải được bác sĩ xử lý trước khi đóng.
        // Nếu không, hồ sơ đóng lại mà vẫn còn kết quả chưa ai xác nhận.
        var pending = await _repository.AiDiagnoses
            .Where(d => d.FundusImage!.VisitId == id)
            .CountAsync(d => !_repository.DiagnosisReviews.Any(r => r.AiDiagnosisId == d.Id));

        if (pending > 0)
            throw AppException.BadRequest(Msg.ConclusionNeeded,
                $"Còn {pending} kết quả AI chưa được duyệt hoặc ghi đè trong lượt khám này.");

        // Mức DR đã xác nhận, lấy mắt nặng hơn (BR-21)
        var worstGrade = await _repository.DiagnosisReviews
            .Where(r => r.AiDiagnosis!.FundusImage!.VisitId == id)
            .Select(r => (byte?)(byte)r.FinalGrade)
            .MaxAsync();

        v.Conclusion = req.Conclusion.Trim();
        v.Referral = req.Referral;
        v.RecheckMonths = req.RecheckMonths
            ?? (worstGrade is byte g ? await _cfg.GetRecheckMonthsAsync((DrGrade)g) : (byte)12);
        v.Status = VisitStatus.Completed;
        v.ClosedAt = DateTime.UtcNow;
        if (v.DoctorId is null) v.DoctorId = _me.Id;

        var patient = await _repository.Patients.FirstAsync(p => p.Id == v.PatientId);

        _notify.PushToPatient(patient, NotificationType.Result,
            "Kết quả khám đã được xác nhận",
            $"Kết quả lượt khám ngày {v.VisitDate:dd/MM/yyyy} đã được bác sĩ xác nhận.",
            nameof(Visit), v.Id);

        // NF-11 — nhắc tái tầm soát.
        // Không tạo bản ghi lịch hẹn: ngày tái khám được TÍNH từ ClosedAt +
        // RecheckMonths mỗi khi cần (xem RecheckController). Ở đây chỉ gửi
        // thông báo cho bệnh nhân biết mốc thời gian.
        var dueDate = v.ClosedAt!.Value.AddMonths(v.RecheckMonths!.Value);
        var referralNote = v.Referral >= ReferralType.Ophthalmology
            ? " Bạn cũng cần đến Khoa Mắt theo chỉ định của bác sĩ."
            : "";

        _notify.PushToPatient(patient, NotificationType.Recheck,
            "Lịch tái tầm soát tiếp theo",
            $"Bạn cần tái tầm soát võng mạc trước ngày {dueDate:dd/MM/yyyy} " +
            $"(sau {v.RecheckMonths} tháng). Vui lòng đến phòng khám trong giờ làm việc.{referralNote}",
            nameof(Visit), v.Id);

        await _audit.LogAsync(AuditAction.VisitClose, nameof(Visit), v.Id, null,
            new { v.Conclusion, Referral = v.Referral?.ToString(), v.RecheckMonths, worstGrade });
        await _repository.SaveChangesAsync();

        return Ok(await GetDtoAsync(v.Id));
    }

    /// <summary>UC-21 — thu hồi lượt khám (lan sang ảnh, kết quả AI, review, đơn thuốc).</summary>
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        await _void.VoidVisitAsync(id, req.Reason);
        return Ok(new { message = "Đã thu hồi lượt khám và các bản ghi liên quan." });
    }

    private async Task<VisitDto> GetDtoAsync(int id) =>
        await _repository.Visits.AsNoTracking().Where(v => v.Id == id).Select(MapVisit).FirstAsync();

    /// <summary>
    /// Dùng Expression chứ không phải method thường: EF Core chỉ dịch được
    /// Expression sang SQL. Gọi một static method trong Select sẽ khiến EF
    /// kéo toàn bộ bảng về bộ nhớ rồi mới chiếu.
    /// </summary>
    private static readonly System.Linq.Expressions.Expression<Func<Visit, VisitDto>> MapVisit = v => new VisitDto
    {
        Id = v.Id,
        PatientId = v.PatientId,
        PatientName = v.Patient!.FullName,
        PatientCode = v.Patient.Code,
        DoctorId = v.DoctorId,
        DoctorName = v.Doctor != null ? v.Doctor.FullName : null,
        VisitDate = v.VisitDate,
        Status = (byte)v.Status,
        Conclusion = v.Conclusion,
        Referral = (byte?)v.Referral,
        RecheckMonths = v.RecheckMonths,
        ClosedAt = v.ClosedAt,
        ImageCount = v.Images.Count(i => !i.IsVoided),
        PendingReviewCount = v.Images
            .SelectMany(i => i.Diagnoses)
            .Count(d => !d.IsVoided && !d.Reviews.Any(r => !r.IsVoided))
    };
}
