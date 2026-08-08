using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

public partial interface IRepository
{
    Task<Visit?> GetVisitForExportAsync(int visitId, CancellationToken ct = default);
    Task<IReadOnlyList<DiagnosisReview>> GetVisitDiagnosisReviewsForExportAsync(int visitId, CancellationToken ct = default);
    Task<IReadOnlyList<Prescription>> GetVisitPrescriptionsForExportAsync(int visitId, CancellationToken ct = default);
    Task<IReadOnlyList<DiagnosisReview>> GetDiagnosisReviewsForExportAsync(
        int? modelVersionId,
        DateTime? fromUtc,
        DateTime? toExclusiveUtc,
        bool overridesOnly,
        CancellationToken ct = default);
}
