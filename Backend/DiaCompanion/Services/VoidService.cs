using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>
/// QT-6: void dây chuyền xử lý ở TẦNG ỨNG DỤNG, không dùng ON DELETE CASCADE.
/// Cascade ở tầng CSDL là code chết khi không bao giờ xoá cứng, và nguy hiểm
/// nếu ai đó chạy DELETE thủ công — sẽ âm thầm xoá MedicationLogs, tức mất
/// sạch lịch sử tuân thủ thuốc.
/// </summary>
public interface IVoidService
{
    Task VoidPatientAsync(int id, string reason);
    Task VoidVisitAsync(int id, string reason);
    Task VoidImageAsync(int id, string reason);
    Task VoidDiagnosisAsync(int id, string reason);
    Task VoidReviewAsync(int id, string reason);
    Task VoidPrescriptionAsync(int id, string reason);
}

public class VoidService : IVoidService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;

    public VoidService(IRepository repository, ICurrentUser me, IAuditService audit)
    { _repository = repository; _me = me; _audit = audit; }

    private void Mark(IVoidable e, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw AppException.BadRequest(Msg.VoidReason, "Vui lòng nhập lý do trước khi thu hồi bản ghi.");
        e.IsVoided = true;
        e.VoidReason = reason.Trim();
        e.VoidedBy = _me.RequireId();
        e.VoidedAt = DateTime.UtcNow;
    }

    /* ---------------------------------------------------------------------
       Bảng lan void (DATABASE.md QT-6):

       FundusImage   -> AiDiagnoses của ảnh -> DiagnosisReviews của các kết quả
       AiDiagnosis   -> DiagnosisReviews của kết quả đó
       Visit         -> FundusImages (lan tiếp) + Prescriptions của lượt khám
       Prescription  -> huỷ lịch nhắc CHƯA tới hạn, GIỮ MedicationLogs đã ghi
       Patient       -> toàn bộ chuỗi trên
       --------------------------------------------------------------------- */

    public async Task VoidPatientAsync(int id, string reason)
    {
        var p = await _repository.Patients.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");

        Mark(p, reason);
        await _audit.LogAsync(AuditAction.Void, nameof(Patient), p.Id,
            new { p.Code, p.FullName, isVoided = false }, new { isVoided = true }, reason);

        var visits = await _repository.Visits.Where(v => v.PatientId == id).ToListAsync();
        foreach (var v in visits) await VoidVisitInternalAsync(v, $"Thu hồi theo hồ sơ bệnh nhân: {reason}");

        // Ảnh chưa gắn lượt khám nào cũng phải thu hồi theo
        var orphanImages = await _repository.FundusImages
            .Where(f => f.PatientId == id && f.VisitId == null).ToListAsync();
        foreach (var f in orphanImages) await VoidImageInternalAsync(f, $"Thu hồi theo hồ sơ bệnh nhân: {reason}");

        // Tài khoản đăng nhập cũng phải khoá, nếu không bệnh nhân vẫn vào được
        // hồ sơ đã thu hồi. Khoá cũng giải phóng số điện thoại nhờ filtered index.
        if (p.UserId is int uid)
        {
            var u = await _repository.Users.FirstOrDefaultAsync(x => x.Id == uid);
            if (u is not null) { u.IsActive = false; u.UpdatedAt = DateTime.UtcNow; }
        }

        await _repository.SaveChangesAsync();
    }

    public async Task VoidVisitAsync(int id, string reason)
    {
        var v = await _repository.Visits.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");
        await VoidVisitInternalAsync(v, reason);
        await _audit.LogAsync(AuditAction.Void, nameof(Visit), v.Id, null, new { isVoided = true }, reason);
        await _repository.SaveChangesAsync();
    }

    private async Task VoidVisitInternalAsync(Visit v, string reason)
    {
        if (v.IsVoided) return;
        Mark(v, reason);

        var images = await _repository.FundusImages.Where(f => f.VisitId == v.Id).ToListAsync();
        foreach (var f in images) await VoidImageInternalAsync(f, $"Thu hồi theo lượt khám: {reason}");

        var prescriptions = await _repository.Prescriptions.Where(p => p.VisitId == v.Id).ToListAsync();
        foreach (var p in prescriptions) await VoidPrescriptionInternalAsync(p, $"Thu hồi theo lượt khám: {reason}");
    }

    public async Task VoidImageAsync(int id, string reason)
    {
        var f = await _repository.FundusImages.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy ảnh đáy mắt.");
        await VoidImageInternalAsync(f, reason);
        await _audit.LogAsync(AuditAction.Void, nameof(FundusImage), f.Id, null, new { isVoided = true }, reason);
        await _repository.SaveChangesAsync();
    }

    private async Task VoidImageInternalAsync(FundusImage f, string reason)
    {
        if (f.IsVoided) return;
        Mark(f, reason);

        var diagnoses = await _repository.AiDiagnoses.Where(d => d.FundusImageId == f.Id).ToListAsync();
        foreach (var d in diagnoses) await VoidDiagnosisInternalAsync(d, $"Thu hồi theo ảnh: {reason}");
    }

    public async Task VoidDiagnosisAsync(int id, string reason)
    {
        var d = await _repository.AiDiagnoses.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy kết quả AI.");
        await VoidDiagnosisInternalAsync(d, reason);
        await _audit.LogAsync(AuditAction.Void, nameof(AiDiagnosis), d.Id, null, new { isVoided = true }, reason);
        await _repository.SaveChangesAsync();
    }

    private async Task VoidDiagnosisInternalAsync(AiDiagnosis d, string reason)
    {
        if (d.IsVoided) return;
        Mark(d, reason);

        var reviews = await _repository.DiagnosisReviews.Where(r => r.AiDiagnosisId == d.Id).ToListAsync();
        foreach (var r in reviews) if (!r.IsVoided) Mark(r, $"Thu hồi theo kết quả AI: {reason}");
    }

    public async Task VoidReviewAsync(int id, string reason)
    {
        var r = await _repository.DiagnosisReviews.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bản ghi duyệt.");
        Mark(r, reason);
        await _audit.LogAsync(AuditAction.Void, nameof(DiagnosisReview), r.Id,
            new { r.Action, r.FinalGrade }, new { isVoided = true }, reason);
        await _repository.SaveChangesAsync();
        // Ca quay lại hàng đợi triage vì unique index UX_Review_PerDiagnosis
        // chỉ tính review chưa void.
    }

    public async Task VoidPrescriptionAsync(int id, string reason)
    {
        var p = await _repository.Prescriptions.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy đơn thuốc.");
        await VoidPrescriptionInternalAsync(p, reason);
        await _audit.LogAsync(AuditAction.Void, nameof(Prescription), p.Id, null, new { isVoided = true }, reason);
        await _repository.SaveChangesAsync();
    }

    private async Task VoidPrescriptionInternalAsync(Prescription p, string reason)
    {
        if (p.IsVoided) return;
        Mark(p, reason);

        // Huỷ các liều CHƯA tới hạn.
        // Liều bệnh nhân ĐÃ xác nhận uống thì GIỮ NGUYÊN: thu hồi đơn vì lập sai
        // không xoá được sự kiện đã xảy ra ngoài đời, và bác sĩ cần dữ liệu này
        // để hiểu bệnh nhân đã dùng thuốc gì.
        var itemIds = await _repository.PrescriptionItems
            .Where(i => i.PrescriptionId == p.Id).Select(i => i.Id).ToListAsync();

        var pending = await _repository.MedicationLogs  
            .Where(m => itemIds.Contains(m.PrescriptionItemId) && m.Status == MedicationStatus.Pending)
            .ToListAsync();

        foreach (var m in pending) m.Status = MedicationStatus.Cancelled;
    }
}
