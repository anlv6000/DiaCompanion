using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

public sealed partial class EfRepository
{
    public Task<Visit?> GetVisitForExportAsync(int visitId, CancellationToken ct = default) =>
        _db.Visits.AsNoTracking()
            .Include(v => v.Patient)
            .Include(v => v.Doctor)
            .FirstOrDefaultAsync(v => v.Id == visitId, ct);

    public async Task<IReadOnlyList<DiagnosisReview>> GetVisitDiagnosisReviewsForExportAsync(
        int visitId, CancellationToken ct = default) =>
        await _db.DiagnosisReviews.AsNoTracking()
            .Include(r => r.Doctor)
            .Include(r => r.AiDiagnosis)!.ThenInclude(d => d.ModelVersion)
            .Include(r => r.AiDiagnosis)!.ThenInclude(d => d.FundusImage)!.ThenInclude(f => f.Patient)
            .Where(r => r.AiDiagnosis!.FundusImage!.VisitId == visitId)
            .OrderBy(r => r.AiDiagnosis!.FundusImage!.Eye)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Prescription>> GetVisitPrescriptionsForExportAsync(
        int visitId, CancellationToken ct = default) =>
        await _db.Prescriptions.AsNoTracking()
            .Include(p => p.Items)
            .Where(p => p.VisitId == visitId)
            .OrderBy(p => p.IssuedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<DiagnosisReview>> GetDiagnosisReviewsForExportAsync(
        int? modelVersionId,
        DateTime? fromUtc,
        DateTime? toExclusiveUtc,
        bool overridesOnly,
        CancellationToken ct = default)
    {
        var query = _db.DiagnosisReviews.AsNoTracking()
            .Include(r => r.Doctor)
            .Include(r => r.AiDiagnosis)!.ThenInclude(d => d.ModelVersion)
            .Include(r => r.AiDiagnosis)!.ThenInclude(d => d.FundusImage)!.ThenInclude(f => f.Patient)
            .AsQueryable();

        if (overridesOnly)
            query = query.Where(r => r.Action == ReviewAction.Override);
        if (modelVersionId is int mv)
            query = query.Where(r => r.AiDiagnosis!.ModelVersionId == mv);
        if (fromUtc is DateTime from)
            query = query.Where(r => r.CreatedAt >= from);
        if (toExclusiveUtc is DateTime to)
            query = query.Where(r => r.CreatedAt < to);

        return await query.ToListAsync(ct);
    }
}
