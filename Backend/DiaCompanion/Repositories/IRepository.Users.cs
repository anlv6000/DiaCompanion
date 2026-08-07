using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

public sealed record StaffUserData(User User, IReadOnlyList<string> Roles);
public sealed record StaffPage(IReadOnlyList<StaffUserData> Items, int Total);

public partial interface IRepository
{
    Task<StaffPage> GetStaffPageAsync(string? q, string? roleName, bool? isActive, PageQuery page, CancellationToken ct = default);
    Task<StaffUserData?> GetStaffAsync(int id, bool tracking, CancellationToken ct = default);
    Task<bool> ActiveEmailExistsAsync(string email, int? exceptUserId = null, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetActiveRoleNamesByNamesAsync(IEnumerable<string> names, CancellationToken ct = default);
    Task SyncUserRolesAsync(User user, IEnumerable<string> roleNames, int? assignedBy, CancellationToken ct = default);
    Task<int> CountOtherActiveUsersInRoleAsync(int excludedUserId, string roleName, CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetActiveUsersInRoleAsync(string roleName, CancellationToken ct = default);
    Task<bool> IsActiveUserInRoleAsync(int userId, string roleName, CancellationToken ct = default);
}
