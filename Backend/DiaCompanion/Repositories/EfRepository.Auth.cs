using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

public sealed partial class EfRepository
{
    public async Task<AuthUserData?> GetUserByLoginAsync(string? email, string? phone, CancellationToken ct = default)
    {
        var normalizedEmail = string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
        var normalizedPhone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();

        var user = await _db.Users
            .Where(u =>
                (normalizedPhone != null && u.Phone == normalizedPhone) ||
                (normalizedEmail != null && u.Email == normalizedEmail))
            .OrderByDescending(u => u.IsActive)
            .ThenByDescending(u => u.Id)
            .FirstOrDefaultAsync(ct);

        if (user is null) return null;
        var roles = await GetActiveRoleNamesAsync(user.Id, ct);
        var patientId = await GetPatientIdByUserIdAsync(user.Id, ct);
        return new AuthUserData(user, roles, patientId);
    }

    public async Task<AuthUserData?> GetActiveUserByPhoneAsync(string phone, CancellationToken ct = default)
    {
        var normalized = phone.Trim();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Phone == normalized && u.IsActive, ct);
        if (user is null) return null;
        var roles = await GetActiveRoleNamesAsync(user.Id, ct);
        var patientId = await GetPatientIdByUserIdAsync(user.Id, ct);
        return new AuthUserData(user, roles, patientId);
    }

    public async Task<AuthUserData?> GetAuthUserByIdAsync(int userId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return null;
        var roles = await GetActiveRoleNamesAsync(user.Id, ct);
        var patientId = await GetPatientIdByUserIdAsync(user.Id, ct);
        return new AuthUserData(user, roles, patientId);
    }

    public async Task<AuthorizationSnapshot?> GetAuthorizationSnapshotAsync(int userId, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.IsActive, u.MustChangePassword, u.FullName })
            .FirstOrDefaultAsync(ct);
        if (user is null) return null;

        var roles = await GetActiveRoleNamesAsync(userId, ct);
        var patientId = await GetPatientIdByUserIdAsync(userId, ct);
        return new AuthorizationSnapshot(user.IsActive, roles, patientId, user.MustChangePassword, user.FullName);
    }

    public Task<int?> GetPatientIdByUserIdAsync(int userId, CancellationToken ct = default) =>
        _db.Patients.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => (int?)p.Id)
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<string>> GetActiveRoleNamesAsync(int userId, CancellationToken ct = default) =>
        await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == userId && ur.IsActive && ur.Role.IsActive)
            .OrderBy(ur => ur.Role.Name)
            .Select(ur => ur.Role.Name)
            .Distinct()
            .ToListAsync(ct);

    public Task<bool> HasActiveRoleAsync(int userId, string roleName, CancellationToken ct = default) =>
        _db.UserRoles.AsNoTracking().AnyAsync(ur =>
            ur.UserId == userId && ur.IsActive && ur.Role.IsActive && ur.Role.Name == roleName, ct);
}
