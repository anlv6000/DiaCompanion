using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

public sealed partial class EfRepository
{
    public async Task<StaffPage> GetStaffPageAsync(
        string? q, string? roleName, bool? isActive, PageQuery page, CancellationToken ct = default)
    {
        var query = _db.Users.AsNoTracking()
            .Where(u => u.UserRoles.Any(ur => ur.IsActive && ur.Role.IsActive && ur.Role.Name != Roles.Patient));

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(u => u.FullName.Contains(term) || (u.Email != null && u.Email.Contains(term)));
        }
        if (!string.IsNullOrWhiteSpace(roleName))
        {
            var role = roleName.Trim();
            query = query.Where(u => u.UserRoles.Any(ur => ur.IsActive && ur.Role.IsActive && ur.Role.Name == role));
        }
        if (isActive is bool active)
            query = query.Where(u => u.IsActive == active);

        var total = await query.CountAsync(ct);
        query = page.Sort?.ToLowerInvariant() switch
        {
            "name" => page.Desc ? query.OrderByDescending(u => u.FullName) : query.OrderBy(u => u.FullName),
            "created" => page.Desc ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt),
            _ => query.OrderBy(u => u.FullName)
        };

        var users = await query.Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);
        var userIds = users.Select(u => u.Id).ToArray();
        var roleRows = await _db.UserRoles.AsNoTracking()
            .Where(ur => userIds.Contains(ur.UserId) && ur.IsActive && ur.Role.IsActive)
            .Select(ur => new { ur.UserId, ur.Role.Name })
            .ToListAsync(ct);
        var rolesByUser = roleRows.GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.Name)
                .Distinct(StringComparer.OrdinalIgnoreCase).ToList());

        var items = users.Select(u => new StaffUserData(
            u, rolesByUser.GetValueOrDefault(u.Id) ?? Array.Empty<string>())).ToList();
        return new StaffPage(items, total);
    }

    public async Task<StaffUserData?> GetStaffAsync(int id, bool tracking, CancellationToken ct = default)
    {
        IQueryable<User> query = _db.Users.Where(u => u.Id == id &&
            u.UserRoles.Any(ur => ur.IsActive && ur.Role.IsActive && ur.Role.Name != Roles.Patient));
        if (!tracking)
            query = query.AsNoTracking();

        var user = await query.FirstOrDefaultAsync(ct);
        if (user is null)
            return null;

        var roles = await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == id && ur.IsActive && ur.Role.IsActive)
            .Select(ur => ur.Role.Name)
            .Distinct()
            .ToListAsync(ct);
        return new StaffUserData(user, roles);
    }

    public Task<bool> ActiveEmailExistsAsync(string email, int? exceptUserId = null, CancellationToken ct = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return _db.Users.AnyAsync(u => u.Email == normalized && u.IsActive &&
            (!exceptUserId.HasValue || u.Id != exceptUserId.Value), ct);
    }

    public async Task<IReadOnlyList<string>> GetActiveRoleNamesByNamesAsync(
        IEnumerable<string> names, CancellationToken ct = default)
    {
        var requested = names.Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        return await _db.Roles.AsNoTracking()
            .Where(r => r.IsActive && requested.Contains(r.Name))
            .Select(r => r.Name)
            .ToListAsync(ct);
    }

    public async Task SyncUserRolesAsync(User user, IEnumerable<string> roleNames, int? assignedBy, CancellationToken ct = default)
    {
        var names = roleNames.Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var roles = await _db.Roles.Where(r => r.IsActive && names.Contains(r.Name)).ToListAsync(ct);
        var existing = await _db.UserRoles.Where(ur => ur.UserId == user.Id).ToListAsync(ct);
        var desiredIds = roles.Select(r => r.Id).ToHashSet();

        foreach (var assignment in existing)
        {
            var shouldBeActive = desiredIds.Contains(assignment.RoleId);
            if (assignment.IsActive == shouldBeActive) continue;

            assignment.IsActive = shouldBeActive;
            if (shouldBeActive)
            {
                assignment.AssignedAt = DateTime.UtcNow;
                assignment.AssignedBy = assignedBy;
            }
        }

        var existingIds = existing.Select(x => x.RoleId).ToHashSet();
        foreach (var role in roles.Where(r => !existingIds.Contains(r.Id)))
        {
            _db.UserRoles.Add(new UserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
                AssignedBy = assignedBy,
                AssignedAt = DateTime.UtcNow,
                IsActive = true
            });
        }
    }

    public Task<int> CountOtherActiveUsersInRoleAsync(int excludedUserId, string roleName, CancellationToken ct = default) =>
        _db.Users.CountAsync(u => u.Id != excludedUserId && u.IsActive &&
            u.UserRoles.Any(ur => ur.IsActive && ur.Role.IsActive && ur.Role.Name == roleName), ct);

    public async Task<IReadOnlyList<User>> GetActiveUsersInRoleAsync(string roleName, CancellationToken ct = default) =>
        await _db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.IsActive && ur.Role.IsActive && ur.Role.Name == roleName))
            .OrderBy(u => u.FullName)
            .ToListAsync(ct);

    public Task<bool> IsActiveUserInRoleAsync(int userId, string roleName, CancellationToken ct = default) =>
        _db.Users.AsNoTracking().AnyAsync(u => u.Id == userId && u.IsActive &&
            u.UserRoles.Any(ur => ur.IsActive && ur.Role.IsActive && ur.Role.Name == roleName), ct);
}
