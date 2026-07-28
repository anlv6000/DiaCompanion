using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-34, UC-35 — kết xuất dữ liệu.</summary>
public class ExportService : BaseService, IExportService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;

    public ExportService(IRepository repository, ICurrentUser me, IAuditService audit)
    { _repository = repository; _me = me; _audit = audit; }

    /// <summary>
    /// UC-34 — dữ liệu báo cáo khám.
    ///
    /// Trả JSON để client dựng PDF, thay vì sinh PDF ở server: bản Electron
    /// đã có sẵn khả năng in, và làm vậy tránh thêm phụ thuộc thư viện PDF
    /// vào backend. Bệnh nhân cũng gọi được endpoint này cho lượt khám của mình
    /// (BR-13), nhưng CHỈ khi lượt khám đã hoàn tất.
    /// </summary>
    public async Task<IActionResult> VisitReport(int visitId)
    {
        var visit = await _repository.Visits.AsNoTracking()
            .Include(v => v.Patient).Include(v => v.Doctor)
            .FirstOrDefaultAsync(v => v.Id == visitId)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");

        EnsureCanAccessPatient(_me, visit.PatientId);

        // BR-13: bệnh nhân chỉ xem được kết quả bác sĩ ĐÃ xác nhận.
        // Không có kiểm tra này thì bệnh nhân tải được báo cáo chứa kết quả AI thô.
        if (_me.Role == UserRole.Patient && visit.Status != VisitStatus.Completed)
            throw AppException.Forbidden(Msg.Forbidden,
                "Kết quả lượt khám này chưa được bác sĩ xác nhận.");

        var findings = await _repository.DiagnosisReviews.AsNoTracking()
            .Where(r => r.AiDiagnosis!.FundusImage!.VisitId == visitId)
            .Select(r => new
            {
                Eye = (byte)r.AiDiagnosis!.FundusImage!.Eye,
                ImageId = r.AiDiagnosis.FundusImageId,
                FinalGrade = (byte)r.FinalGrade,
                Action = (byte)r.Action,
                r.Reason,
                AiGrade = (byte)r.AiDiagnosis.DrGrade,
                r.AiDiagnosis.Confidence,
                r.AiDiagnosis.Disagreement,
                r.AiDiagnosis.IsDeferred,
                r.AiDiagnosis.FractalDimension,
                r.AiDiagnosis.CountMA,
                r.AiDiagnosis.CountHE,
                r.AiDiagnosis.CountEX,
                r.AiDiagnosis.CountSE,
                ModelVersion = r.AiDiagnosis.ModelVersion!.Name,
                DoctorName = r.Doctor!.FullName,
                r.CreatedAt
            }).ToListAsync();

        var prescriptions = await _repository.Prescriptions.AsNoTracking()
            .Where(p => p.VisitId == visitId)
            .Select(p => new
            {
                p.IssuedAt,
                p.Note,
                Items = p.Items.Select(i => new { i.DrugName, i.Dose, i.TimesPerDay, i.DurationDays, i.Instruction })
            }).ToListAsync();

        await _audit.LogAsync(AuditAction.Export, nameof(Visit), visitId, detail: "Xuất báo cáo khám");
        await _repository.SaveChangesAsync();

        return Ok(new
        {
            clinic = new { name = "DiaCompanion", subtitle = "Hệ thống hỗ trợ sàng lọc bệnh võng mạc đái tháo đường" },
            patient = new
            {
                visit.Patient!.Code,
                visit.Patient.FullName,
                visit.Patient.DateOfBirth,
                visit.Patient.Gender,
                visit.Patient.Phone,
                visit.Patient.DiabetesType,
                visit.Patient.DiabetesDurationYears
            },
            visit = new
            {
                visit.Id,
                visit.VisitDate,
                Status = (byte)visit.Status,
                visit.Conclusion,
                Referral = (byte?)visit.Referral,
                visit.RecheckMonths,
                visit.ClosedAt,
                DoctorName = visit.Doctor?.FullName,
                DoctorLicense = visit.Doctor?.LicenseNo
            },
            findings = findings.Select(f => new
            {
                f.Eye,
                f.ImageId,
                finalGrade = f.FinalGrade,
                finalGradeLabel = DiagnosesService.GradeLabel(f.FinalGrade),
                confirmedBy = f.DoctorName,
                f.CreatedAt,
                // Ghi rõ AI đề xuất gì và bác sĩ quyết định gì — minh bạch cho hồ sơ
                ai = new
                {
                    grade = f.AiGrade,
                    gradeLabel = DiagnosesService.GradeLabel(f.AiGrade),
                    f.Confidence,
                    f.Disagreement,
                    f.IsDeferred,
                    model = f.ModelVersion,
                    wasOverridden = f.Action == 1,
                    overrideReason = f.Reason
                },
                lesions = new { f.CountMA, f.CountHE, f.CountEX, f.CountSE },
                fractal = f.FractalDimension
            }),
            prescriptions,
            disclaimer = "Kết quả AI mang tính hỗ trợ quyết định. Phân độ cuối cùng do bác sĩ xác lập.",
            generatedAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// UC-35 — tập ca người–máy mâu thuẫn.
    ///
    /// Đây là dữ liệu đánh giá chính của đề tài: nếu tỉ lệ ghi đè trong nhóm
    /// BỊ GẮN CỜ cao hơn hẳn nhóm không gắn cờ, nghĩa là cơ chế deferral đang
    /// bắt đúng những ca mà mô hình thực sự sai.
    /// </summary>
    public async Task<ActionResult<object>> DisagreementCases([FromQuery] int? modelVersionId)
    {
        var query = _repository.DiagnosisReviews.AsNoTracking()
            .Where(r => r.Action == ReviewAction.Override);

        if (modelVersionId is int mv)
            query = query.Where(r => r.AiDiagnosis!.ModelVersionId == mv);

        var cases = await query.Select(r => new DisagreementCaseDto
        {
            AiDiagnosisId = r.AiDiagnosisId,
            PatientCode = r.AiDiagnosis!.FundusImage!.Patient!.Code,
            Eye = (byte)r.AiDiagnosis.FundusImage.Eye,
            ModelVersion = r.AiDiagnosis.ModelVersion!.Name,
            AiGrade = (byte)r.AiDiagnosis.DrGrade,
            DoctorGrade = (byte)r.FinalGrade,
            GradeDistance = Math.Abs((byte)r.FinalGrade - (byte)r.AiDiagnosis.DrGrade),
            Confidence = r.AiDiagnosis.Confidence,
            Disagreement = r.AiDiagnosis.Disagreement,
            WasDeferred = r.AiDiagnosis.IsDeferred,
            Reason = r.Reason,
            ReviewedAt = r.CreatedAt
        }).OrderByDescending(c => c.GradeDistance).ThenByDescending(c => c.ReviewedAt).ToListAsync();

        // Tính chỉ số tổng hợp trên TOÀN BỘ review, không chỉ ca ghi đè
        var allReviews = await _repository.DiagnosisReviews.AsNoTracking()
            .Where(r => modelVersionId == null || r.AiDiagnosis!.ModelVersionId == modelVersionId)
            .Select(r => new { Action = (byte)r.Action, Deferred = r.AiDiagnosis!.IsDeferred })
            .ToListAsync();

        var deferredSet = allReviews.Where(r => r.Deferred).ToList();
        var notDeferredSet = allReviews.Where(r => !r.Deferred).ToList();

        var rateIn = deferredSet.Count == 0 ? 0
            : Math.Round(deferredSet.Count(r => r.Action == 1) * 100m / deferredSet.Count, 1);
        var rateOut = notDeferredSet.Count == 0 ? 0
            : Math.Round(notDeferredSet.Count(r => r.Action == 1) * 100m / notDeferredSet.Count, 1);

        var summary = new DisagreementSummaryDto
        {
            TotalReviewed = allReviews.Count,
            TotalOverridden = allReviews.Count(r => r.Action == 1),
            OverrideRate = allReviews.Count == 0 ? 0
                : Math.Round(allReviews.Count(r => r.Action == 1) * 100m / allReviews.Count, 1),
            DeferredCount = deferredSet.Count,
            OverrideRateWithinDeferred = rateIn,
            OverrideRateOutsideDeferred = rateOut,
            AvgDisagreement = cases.Count == 0 ? 0
                : Math.Round(cases.Average(c => c.Disagreement ?? 0), 4),
            Interpretation = rateIn > rateOut
                ? $"Tỉ lệ ghi đè trong nhóm gắn cờ ({rateIn}%) cao hơn nhóm không gắn cờ ({rateOut}%) — " +
                  "cơ chế chuyển bác sĩ đang tập trung đúng vào các ca mô hình dễ sai."
                : $"Tỉ lệ ghi đè trong nhóm gắn cờ ({rateIn}%) chưa cao hơn nhóm không gắn cờ ({rateOut}%) — " +
                  "cần xem lại ngưỡng hoặc cách tính bất đồng."
        };

        await _audit.LogAsync(AuditAction.Export, "DisagreementCases", null,
            detail: $"Kết xuất {cases.Count} ca mâu thuẫn");
        await _repository.SaveChangesAsync();

        return Ok(new { summary, cases });
    }

    /// <summary>UC-35 — kết xuất CSV để phân tích ngoài hệ thống.</summary>
    public async Task<IActionResult> DisagreementCsv([FromQuery] int? modelVersionId)
    {
        var query = _repository.DiagnosisReviews.AsNoTracking()
            .Where(r => r.Action == ReviewAction.Override);
        if (modelVersionId is int mv) query = query.Where(r => r.AiDiagnosis!.ModelVersionId == mv);

        var rows = await query.Select(r => new
        {
            r.AiDiagnosisId,
            PatientCode = r.AiDiagnosis!.FundusImage!.Patient!.Code,
            Eye = (byte)r.AiDiagnosis.FundusImage.Eye,
            Model = r.AiDiagnosis.ModelVersion!.Name,
            AiGrade = (byte)r.AiDiagnosis.DrGrade,
            LesionGrade = (byte?)r.AiDiagnosis.LesionGradeImplied,
            DoctorGrade = (byte)r.FinalGrade,
            r.AiDiagnosis.Confidence,
            r.AiDiagnosis.Disagreement,
            r.AiDiagnosis.IsDeferred,
            r.AiDiagnosis.FractalDimension,
            r.Reason,
            r.CreatedAt
        }).ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("ai_diagnosis_id,patient_code,eye,model,ai_grade,lesion_implied_grade,doctor_grade," +
                      "grade_distance,confidence,disagreement,was_deferred,fractal_dimension,reviewed_at,reason");

        foreach (var r in rows)
        {
            var distance = Math.Abs(r.DoctorGrade - r.AiGrade);
            // Bọc lý do trong dấu nháy kép và nhân đôi nháy bên trong, vì lý do
            // là văn bản tự do có thể chứa dấu phẩy
            var reason = (r.Reason ?? "").Replace("\"", "\"\"");
            sb.AppendLine($"{r.AiDiagnosisId},{r.PatientCode},{r.Eye},{r.Model},{r.AiGrade}," +
                          $"{r.LesionGrade},{r.DoctorGrade},{distance},{r.Confidence},{r.Disagreement}," +
                          $"{(r.IsDeferred ? 1 : 0)},{r.FractalDimension},{r.CreatedAt:O},\"{reason}\"");
        }

        await _audit.LogAsync(AuditAction.Export, "DisagreementCases", null,
            detail: $"Kết xuất CSV {rows.Count} ca");
        await _repository.SaveChangesAsync();

        // BOM để Excel mở đúng tiếng Việt
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv", $"disagreement-cases-{DateTime.UtcNow:yyyyMMdd}.csv");
    }
}
