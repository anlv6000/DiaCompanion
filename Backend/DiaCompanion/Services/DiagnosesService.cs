using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-25, UC-27, UC-28, UC-29 — suy luận AI và diễn tiến.</summary>
public class DiagnosesService : BaseService, IDiagnosesService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IAiInferenceClient _ai;
    private readonly IDeferralService _deferral;
    private readonly IConfigService _cfg;
    private readonly IVoidService _void;

    public DiagnosesService(IRepository repository, ICurrentUser me, IAuditService audit,
                               IAiInferenceClient ai, IDeferralService deferral,
                               IConfigService cfg, IVoidService voidSvc)
    { _repository = repository; _me = me; _audit = audit; _ai = ai; _deferral = deferral; _cfg = cfg; _void = voidSvc; }

    /// <summary>
    /// UC-25 + UC-27 + UC-28 — chạy suy luận cho một ảnh.
    ///
    /// Ba việc trong một giao dịch: hai nhánh của mô hình (phân độ + phân vùng),
    /// chỉ số fractal, và tính bất đồng chéo để quyết định có chuyển bác sĩ hay không.
    ///
    /// NT-3: KHÔNG ghi FinalGrade ở đây. Kết quả nằm ở trạng thái "chưa xác nhận"
    /// cho tới khi bác sĩ duyệt hoặc ghi đè (UC-31 / UC-32).
    /// </summary>
    public async Task<ActionResult<AiDiagnosisDto>> Run(int imageId, CancellationToken ct)
    {
        var image = await _repository.FundusImages

    .Include(x => x.Visit)
    .FirstOrDefaultAsync(x => x.Id == imageId, ct)
    ?? throw AppException.NotFound(
        Msg.LoadFailed,
        "Không tìm thấy ảnh đáy mắt.");


        var doctorId = _me.RequireId();

        if (image.Visit?.DoctorId != doctorId)
        {
            throw AppException.Forbidden(
                Msg.Forbidden,
                "Bạn không phải bác sĩ phụ trách lượt khám này.");
        }
        // BR-01 — van chặn bắt buộc. Chạy AI trên ảnh mờ sinh ra kết quả trông
        // hợp lệ nhưng vô nghĩa, nguy hiểm hơn là không có kết quả.
        if (image.QualityStatus != QualityStatus.Gradable)
            throw AppException.BadRequest(Msg.ImageNotGradable,
                "Ảnh chưa đạt chất lượng nên không thể chạy phân tích AI.");

        var model = await _repository.ModelVersions.FirstOrDefaultAsync(m => m.IsActive, ct)
            ?? throw AppException.BadRequest(Msg.AiUnavailable,
                "Chưa có phiên bản mô hình nào được kích hoạt.");

        // Đọc ngưỡng TẠI THỜI ĐIỂM CHẠY và lưu vào bản ghi. Admin đổi ngưỡng
        // sau này không được làm thay đổi kết quả đã sinh ra (BR-17).
        var confThreshold = await _cfg.GetDecimalAsync(ConfigKeys.ConfidenceThreshold, 0.75m);
        var disagreeThreshold = await _cfg.GetDecimalAsync(ConfigKeys.DisagreementThreshold, 0.35m);

        // Nếu dịch vụ suy luận lỗi thì ném ra ngoài — KHÔNG tạo bản ghi rỗng
        // (E2 của UC-25).
        var result = await _ai.RunAsync(image.FilePath, model.FilePath, ct);

        var lesionGrade = result.LesionGradeImplied is byte lg ? (DrGrade)lg : (DrGrade?)null;
        var deferral = _deferral.Evaluate(
            (DrGrade)result.DrGrade, result.Confidence, lesionGrade,
            confThreshold, disagreeThreshold);

        var diagnosis = new AiDiagnosis
        {
            FundusImageId = image.Id,
            ModelVersionId = model.Id,
            DrGrade = (DrGrade)result.DrGrade,
            Confidence = result.Confidence,
            GradeProbabilities = result.Probabilities is null
                ? null
                : System.Text.Json.JsonSerializer.Serialize(result.Probabilities),
            LesionGradeImplied = lesionGrade,
            LesionMaskPath = result.LesionMaskPath,
            CountMA = result.CountMA,
            CountHE = result.CountHE,
            CountEX = result.CountEX,
            CountSE = result.CountSE,
            AreaMA = result.AreaMA,
            AreaHE = result.AreaHE,
            AreaEX = result.AreaEX,
            AreaSE = result.AreaSE,

            Disagreement = deferral.Disagreement,
            IsDeferred = deferral.IsDeferred,
            DeferReason = deferral.Reason,
            ConfidenceThreshold = confThreshold,
            DisagreementThreshold = disagreeThreshold,

            FractalDimension = result.FractalDimension,
            VesselMaskPath = result.VesselMaskPath,
            FractalNote = result.FractalNote,
            InferenceMs = result.InferenceMs
        };

        _repository.AiDiagnoses.Add(diagnosis);
        await _repository.SaveChangesAsync(ct);

        await _audit.LogAsync(AuditAction.AiRun, nameof(AiDiagnosis), diagnosis.Id, null, new
        {
            imageId,
            model = model.Name,
            grade = diagnosis.DrGrade.ToString(),
            confidence = diagnosis.Confidence,
            disagreement = diagnosis.Disagreement,
            deferred = diagnosis.IsDeferred
        });
        await _repository.SaveChangesAsync(ct);

        return Ok(await MapAsync(diagnosis.Id));
    }

    /// <summary>Chi tiết một kết quả AI.</summary>
    public async Task<ActionResult<AiDiagnosisDto>> Get(int id) => Ok(await MapAsync(id));

    /// <summary>Các kết quả AI của một ảnh (gồm cả lần chạy lại).</summary>
    public async Task<ActionResult<List<AiDiagnosisDto>>> ByImage(int imageId)
    {
        var ids = await _repository.AiDiagnoses.AsNoTracking()
            .Where(d => d.FundusImageId == imageId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => d.Id).ToListAsync();

        var list = new List<AiDiagnosisDto>();
        foreach (var id in ids) list.Add(await MapAsync(id));
        return Ok(list);
    }

    /// <summary>UC-24 phần kết quả — thu hồi một kết quả AI.</summary>
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        await _void.VoidDiagnosisAsync(id, req.Reason, req.RowVersion);
        return Ok(new { message = "Đã thu hồi kết quả AI." });
    }

    /// <summary>
    /// UC-29 — diễn tiến: ghép mức DR đã xác nhận, fractal và HbA1c trên một trục
    /// thời gian, nối biến chứng mắt với mức kiểm soát bệnh gốc.
    /// </summary>
    public async Task<ActionResult<ProgressionDto>> Progression(int patientId, [FromQuery] int months = 24)
    {
        EnsureCanAccessPatient(_me, patientId);
        var from = DateTime.UtcNow.AddMonths(-months);

        // Chỉ lấy mức đã được bác sĩ xác nhận — không đưa kết quả AI thô vào
        // biểu đồ diễn tiến (BR-13). Query filter đã loại bản ghi void.
        var confirmed = await _repository.DiagnosisReviews.AsNoTracking()
            .Where(r => r.AiDiagnosis!.FundusImage!.PatientId == patientId && r.CreatedAt >= from)
            .Select(r => new
            {
                r.CreatedAt,
                VisitId = r.AiDiagnosis!.FundusImage!.VisitId,
                Grade = (byte)r.FinalGrade,
                Fd = r.AiDiagnosis.FractalDimension
            }).ToListAsync();

        var hba1c = await _repository.HealthMetrics.AsNoTracking()
            .Where(m => m.PatientId == patientId && m.MetricType == MetricType.HbA1c && m.RecordedAtUtc >= from)
            .Select(m => new { m.RecordedAtUtc, m.Value }).ToListAsync();

        // Gom theo NGÀY để ba chuỗi rơi vào cùng một điểm trên biểu đồ
        var points = confirmed
            .GroupBy(x => x.CreatedAt.Date)
            .Select(g => new ProgressionPoint
            {
                Date = g.Key,
                VisitId = g.Select(x => x.VisitId).FirstOrDefault(),
                // Mắt nặng hơn đại diện cho lần khám (BR-21)
                ConfirmedGrade = g.Max(x => x.Grade),
                FractalDimension = g.Average(x => x.Fd)
            }).ToList();

        foreach (var h in hba1c)
        {
            var day = h.RecordedAtUtc.Date;
            var point = points.FirstOrDefault(p => p.Date == day);
            if (point is null) points.Add(new ProgressionPoint { Date = day, HbA1c = h.Value });
            else point.HbA1c = h.Value;
        }

        points = points.OrderBy(p => p.Date).ToList();

        // NF-09: cảnh báo khi bệnh đang xấu đi
        string? warning = null;
        var graded = points.Where(p => p.ConfirmedGrade.HasValue).ToList();
        if (graded.Count >= 2)
        {
            var first = graded.First().ConfirmedGrade!.Value;
            var last = graded.Last().ConfirmedGrade!.Value;
            if (last > first)
                warning = $"Mức bệnh võng mạc tăng từ {GradeLabel(first)} lên {GradeLabel(last)} " +
                          $"trong {months} tháng gần đây. Cân nhắc rút ngắn chu kỳ tái khám.";
        }

        return Ok(new ProgressionDto { Points = points, TrendWarning = warning });
    }

    public static string GradeLabel(byte g) => g switch
    {
        0 => "Normal",
        1 => "Mild",
        2 => "Moderate",
        3 => "Severe",
        4 => "PDR",
        _ => "?"
    };

    public static string DeferLabel(byte? r) => r switch
    {
        1 => "Độ tin cậy thấp",
        2 => "Bất đồng giữa hai nhánh cao",
        3 => "Tin cậy thấp và bất đồng cao",
        4 => "Thiếu kết quả một nhánh",
        _ => ""
    };

    private async Task<AiDiagnosisDto> MapAsync(int id)
    {
        var d = await _repository.AiDiagnoses.AsNoTracking()
            .Include(x => x.FundusImage)
            .Include(x => x.ModelVersion)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy kết quả AI.");

        var review = await _repository.DiagnosisReviews.AsNoTracking()
            .Include(r => r.Doctor)
            .FirstOrDefaultAsync(r => r.AiDiagnosisId == id);

        return new AiDiagnosisDto
        {
            Id = d.Id,
            FundusImageId = d.FundusImageId,
            Eye = (byte)(d.FundusImage?.Eye ?? 0),
            ModelVersion = d.ModelVersion?.Name ?? "",
            DrGrade = (byte)d.DrGrade,
            DrGradeLabel = GradeLabel((byte)d.DrGrade),
            Confidence = d.Confidence,
            LesionGradeImplied = (byte?)d.LesionGradeImplied,
            CountMA = d.CountMA,
            CountHE = d.CountHE,
            CountEX = d.CountEX,
            CountSE = d.CountSE,
            Disagreement = d.Disagreement,
            IsDeferred = d.IsDeferred,
            DeferReason = (byte?)d.DeferReason,
            DeferReasonLabel = DeferLabel((byte?)d.DeferReason),
            FractalDimension = d.FractalDimension,
            FractalNote = d.FractalNote,
            CreatedAt = d.CreatedAt,
            // NT-3: chỉ "đã xác nhận" khi có review của bác sĩ
            IsConfirmed = review is not null,
            RowVersion = d.ToRowVersion(),
            Review = review is null ? null : new ReviewDto
            {
                Id = review.Id,
                AiDiagnosisId = review.AiDiagnosisId,
                Action = (byte)review.Action,
                ActionLabel = review.Action == ReviewAction.Approve ? "Phê duyệt" : "Ghi đè",
                FinalGrade = (byte)review.FinalGrade,
                FinalGradeLabel = GradeLabel((byte)review.FinalGrade),
                Reason = review.Reason,
                DoctorName = review.Doctor?.FullName ?? "",
                CreatedAt = review.CreatedAt,
                RowVersion = review.ToRowVersion()
            }
        };
    }
}
