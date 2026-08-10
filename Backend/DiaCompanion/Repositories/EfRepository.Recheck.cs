using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Repositories;

public sealed partial class EfRepository
{
    public async Task<IReadOnlyList<RecheckCandidate>> GetRecheckCandidatesAsync(CancellationToken ct = default)
    {
        var allCompleted = await _db.Visits.AsNoTracking()
            .Where(v => v.Status == VisitStatus.Completed && v.ClosedAt != null && v.RecheckMonths != null)
            .Select(v => new
            {
                v.Id, v.MedicalRecord.PatientId, ClosedAt = v.ClosedAt!.Value, RecheckMonths = v.RecheckMonths!.Value,
                v.Referral, v.MedicalRecord.Patient!.Code, v.MedicalRecord.Patient.FullName, v.MedicalRecord.Patient.Phone
            }).ToListAsync(ct);
        if (allCompleted.Count == 0) return Array.Empty<RecheckCandidate>();

        var lastVisits = allCompleted.GroupBy(v => v.PatientId)
            .Select(g => g.OrderByDescending(v => v.ClosedAt).ThenByDescending(v => v.Id).First())
            .ToList();
        var patientIds = lastVisits.Select(v => v.PatientId).ToArray();
        var visitIds = lastVisits.Select(v => v.Id).ToArray();

        var latestDates = await _db.Visits.AsNoTracking().Where(v => patientIds.Contains(v.MedicalRecord.PatientId))
            .GroupBy(v => v.MedicalRecord.PatientId)
            .Select(g => new { PatientId = g.Key, Latest = g.Max(v => v.VisitDate) })
            .ToDictionaryAsync(x => x.PatientId, x => x.Latest, ct);
        var grades = visitIds.Length == 0
            ? new Dictionary<int, byte>()
            : await _db.DiagnosisReviews.AsNoTracking()
                .Where(r => r.AiDiagnosis != null && r.AiDiagnosis.FundusImage != null &&
                            r.AiDiagnosis.FundusImage.VisitId.HasValue && visitIds.Contains(r.AiDiagnosis.FundusImage.VisitId.Value))
                .GroupBy(r => r.AiDiagnosis!.FundusImage!.VisitId!.Value)
                .Select(g => new { VisitId = g.Key, Grade = (byte)g.Max(x => (byte)x.FinalGrade) })
                .ToDictionaryAsync(x => x.VisitId, x => x.Grade, ct);

        return lastVisits.Select(v => new RecheckCandidate(
            v.PatientId, v.Code, v.FullName, v.Phone, v.Id, v.ClosedAt, v.RecheckMonths, v.Referral,
            latestDates.GetValueOrDefault(v.PatientId),
            grades.TryGetValue(v.Id, out var grade) ? grade : null)).ToList();
    }

    public async Task<RecheckCandidate?> GetRecheckCandidateAsync(int patientId, CancellationToken ct = default)
    {
        var visit = await _db.Visits.AsNoTracking()
            .Where(v => v.MedicalRecord.PatientId == patientId && v.Status == VisitStatus.Completed &&
                        v.ClosedAt != null && v.RecheckMonths != null)
            .OrderByDescending(v => v.ClosedAt)
            .Select(v => new
            {
                v.Id,
                PatientId = v.MedicalRecord.PatientId,
                ClosedAt = v.ClosedAt!.Value,
                Months = v.RecheckMonths!.Value,
                v.Referral,
                v.MedicalRecord.Patient!.Code,
                v.MedicalRecord.Patient.FullName,
                v.MedicalRecord.Patient.Phone
            }).FirstOrDefaultAsync(ct);
        if (visit is null) return null;

        var latestVisitDate = await _db.Visits.AsNoTracking().Where(v => v.MedicalRecord.PatientId == patientId)
            .MaxAsync(v => (DateTime?)v.VisitDate, ct);
        var grade = await _db.DiagnosisReviews.AsNoTracking()
            .Where(r => r.AiDiagnosis != null && r.AiDiagnosis.FundusImage != null &&
                        r.AiDiagnosis.FundusImage.VisitId == visit.Id)
            .Select(r => (byte?)(byte)r.FinalGrade).MaxAsync(ct);

        return new RecheckCandidate(
            visit.PatientId, visit.Code, visit.FullName, visit.Phone, visit.Id,
            visit.ClosedAt, visit.Months, visit.Referral, latestVisitDate, grade);
    }
}
