using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

public sealed partial class EfRepository
{
    public async Task<PatientSearchPage> SearchPatientsAsync(
        string? normalizedKeyword,
        string? rawKeyword,
        byte? diabetesType,
        byte? grade,
        PageQuery page,
        CancellationToken ct = default)
    {
        var query = _db.Patients.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(rawKeyword))
        {
            var raw = rawKeyword.Trim();
            var normalized = normalizedKeyword?.Trim() ?? raw;
            query = query.Where(p =>
                EF.Functions.Like(p.FullNameSearch!, $"%{normalized}%") ||
                EF.Functions.Like(p.Code, $"%{raw}%") ||
                EF.Functions.Like(p.Phone, $"%{raw}%"));
        }

        if (diabetesType is byte dt)
            query = query.Where(p => p.DiabetesType == dt);

        var gradeByPatient = _db.DiagnosisReviews.AsNoTracking()
            .Select(r => new
            {
                PatientId = r.AiDiagnosis!.FundusImage!.PatientId,
                Grade = (byte)r.FinalGrade,
                r.CreatedAt
            })
            .GroupBy(x => x.PatientId)
            .Select(g => new
            {
                PatientId = g.Key,
                MaxGrade = (byte?)g.Max(x => x.Grade),
                LastAt = (DateTime?)g.Max(x => x.CreatedAt)
            });

        if (grade is byte gr)
            query = query.Where(p => gradeByPatient.Any(g => g.PatientId == p.Id && g.MaxGrade == gr));

        var total = await query.CountAsync(ct);

        query = (page.Sort?.ToLowerInvariant(), page.Desc) switch
        {
            ("name", false) => query.OrderBy(p => p.FullName),
            ("name", true) => query.OrderByDescending(p => p.FullName),
            ("code", false) => query.OrderBy(p => p.Code),
            ("code", true) => query.OrderByDescending(p => p.Code),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        var baseRows = await query.Skip(page.Skip).Take(page.PageSize)
            .Select(p => new
            {
                p.Id,
                p.Code,
                p.FullName,
                p.Gender,
                p.Phone,
                p.DateOfBirth,
                p.DiabetesType,
                p.DiabetesDurationYears,
                HasAccount = p.UserId != null
            })
            .ToListAsync(ct);

        var ids = baseRows.Select(x => x.Id).ToArray();
        var grades = new Dictionary<int, (byte? Grade, DateTime? At)>();
        if (ids.Length > 0)
        {
            var gradeRows = await gradeByPatient.Where(g => ids.Contains(g.PatientId)).ToListAsync(ct);
            grades = gradeRows.ToDictionary(
                g => g.PatientId,
                g => (Grade: g.MaxGrade, At: g.LastAt));
        }

        var rows = baseRows.Select(r =>
        {
            grades.TryGetValue(r.Id, out var lastGrade);
            return new PatientSearchRow(
                r.Id, r.Code, r.FullName, r.Gender, r.Phone, r.DateOfBirth,
                r.DiabetesType, r.DiabetesDurationYears, r.HasAccount,
                lastGrade.Grade, lastGrade.At);
        }).ToList();

        return new PatientSearchPage(rows, total);
    }

    public Task<bool> PatientPhoneExistsAsync(string phone, int? exceptPatientId = null, CancellationToken ct = default) =>
        _db.Patients.AnyAsync(p => p.Phone == phone &&
            (!exceptPatientId.HasValue || p.Id != exceptPatientId.Value), ct);

    public Task<bool> ActiveUserPhoneExistsAsync(string phone, int? exceptUserId = null, CancellationToken ct = default) =>
        _db.Users.AnyAsync(u => u.Phone == phone && u.IsActive &&
            (!exceptUserId.HasValue || u.Id != exceptUserId.Value), ct);

    public Task<User?> GetUserForUpdateAsync(int userId, CancellationToken ct = default) =>
        _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);

    public Task<string?> GetLastPatientCodeAsync(string prefix, CancellationToken ct = default) =>
        _db.Patients.IgnoreQueryFilters()
            .Where(p => p.Code.StartsWith(prefix))
            .OrderByDescending(p => p.Code)
            .Select(p => p.Code)
            .FirstOrDefaultAsync(ct);

    public async Task<PatientDetailStats> GetPatientDetailStatsAsync(int patientId, CancellationToken ct = default)
    {
        var doctorInCharge = await _db.Visits.AsNoTracking()
            .Where(v => v.PatientId == patientId)
            .OrderByDescending(v => v.VisitDate)
            .Select(v => v.Doctor != null ? v.Doctor.FullName : null)
            .FirstOrDefaultAsync(ct);

        var latestGrade = await _db.DiagnosisReviews.AsNoTracking()
            .Where(r => r.AiDiagnosis!.FundusImage!.PatientId == patientId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => (byte?)(byte)r.FinalGrade)
            .FirstOrDefaultAsync(ct);

        var visitCount = await _db.Visits.CountAsync(v => v.PatientId == patientId, ct);
        return new PatientDetailStats(doctorInCharge, latestGrade, visitCount);
    }

    public async Task<bool> EnsureUserRoleActiveAsync(
        User user, string roleName, int? assignedBy, CancellationToken ct = default)
    {
        var normalized = roleName.Trim();
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.IsActive && r.Name == normalized, ct);
        if (role is null) return false;

        var assignment = await _db.UserRoles.FirstOrDefaultAsync(
            ur => ur.UserId == user.Id && ur.RoleId == role.Id, ct);

        if (assignment is null)
        {
            _db.UserRoles.Add(new UserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
                AssignedAt = DateTime.UtcNow,
                AssignedBy = assignedBy,
                IsActive = true
            });
        }
        else
        {
            assignment.IsActive = true;
            assignment.AssignedAt = DateTime.UtcNow;
            assignment.AssignedBy = assignedBy;
        }

        return true;
    }
}
