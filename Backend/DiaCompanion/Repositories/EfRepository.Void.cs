using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

public sealed partial class EfRepository
{
    public Task<Patient?> GetPatientForVoidAsync(int id, CancellationToken ct = default) =>
        _db.Patients.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<Visit?> GetVisitForVoidAsync(int id, CancellationToken ct = default) =>
        _db.Visits.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<FundusImage?> GetImageForVoidAsync(int id, CancellationToken ct = default) =>
        _db.FundusImages.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<AiDiagnosis?> GetDiagnosisForVoidAsync(int id, CancellationToken ct = default) =>
        _db.AiDiagnoses.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<DiagnosisReview?> GetReviewForVoidAsync(int id, CancellationToken ct = default) =>
        _db.DiagnosisReviews.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<Prescription?> GetPrescriptionForVoidAsync(int id, CancellationToken ct = default) =>
        _db.Prescriptions.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<IReadOnlyList<Visit>> GetActiveVisitsForPatientAsync(int patientId, CancellationToken ct = default) =>
        await _db.Visits.Where(x => x.PatientId == patientId).ToListAsync(ct);

    public async Task<IReadOnlyList<FundusImage>> GetActiveOrphanImagesForPatientAsync(int patientId, CancellationToken ct = default) =>
        await _db.FundusImages.Where(x => x.PatientId == patientId && x.VisitId == null).ToListAsync(ct);

    public async Task<IReadOnlyList<FundusImage>> GetActiveImagesForVisitAsync(int visitId, CancellationToken ct = default) =>
        await _db.FundusImages.Where(x => x.VisitId == visitId).ToListAsync(ct);

    public async Task<IReadOnlyList<Prescription>> GetActivePrescriptionsForVisitAsync(int visitId, CancellationToken ct = default) =>
        await _db.Prescriptions.Where(x => x.VisitId == visitId).ToListAsync(ct);

    public async Task<IReadOnlyList<AiDiagnosis>> GetActiveDiagnosesForImageAsync(int imageId, CancellationToken ct = default) =>
        await _db.AiDiagnoses.Where(x => x.FundusImageId == imageId).ToListAsync(ct);

    public async Task<IReadOnlyList<DiagnosisReview>> GetActiveReviewsForDiagnosisAsync(int diagnosisId, CancellationToken ct = default) =>
        await _db.DiagnosisReviews.Where(x => x.AiDiagnosisId == diagnosisId).ToListAsync(ct);

    public Task<bool> VisitHasFundusImageAsync(int visitId, CancellationToken ct = default) =>
        _db.FundusImages.AnyAsync(x => x.VisitId == visitId, ct);

    public Task<bool> VisitHasPrescriptionAsync(int visitId, CancellationToken ct = default) =>
        _db.Prescriptions.AnyAsync(x => x.VisitId == visitId, ct);

    public Task<bool> IsVisitAssignedToDoctorAsync(
        int visitId, int doctorId, bool includeVoided = false, CancellationToken ct = default)
    {
        IQueryable<Visit> query = includeVoided ? _db.Visits.IgnoreQueryFilters() : _db.Visits;
        return query.AnyAsync(x => x.Id == visitId && x.DoctorId == doctorId, ct);
    }

    public async Task<IReadOnlyList<int>> GetPrescriptionItemIdsAsync(int prescriptionId, CancellationToken ct = default) =>
        await _db.PrescriptionItems.Where(x => x.PrescriptionId == prescriptionId).Select(x => x.Id).ToListAsync(ct);
}
