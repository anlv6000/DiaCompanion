using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-06..11 — quản lý tài khoản nhân viên (Admin).</summary>
public class UsersService : BaseService, IUsersService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IPasswordHasher _hasher;

    public UsersService(IRepository repository, ICurrentUser me, IAuditService audit, IPasswordHasher hasher)
    { _repository = repository; _me = me; _audit = audit; _hasher = hasher; }

    public async Task<ActionResult<PagedResult<StaffUserDto>>> List(
        [FromQuery] string? q, [FromQuery] string? role, [FromQuery] bool? isActive,
        [FromQuery] PageQuery page)
    {
        var data = await _repository.GetStaffPageAsync(q, role, isActive, page);
        return Ok(new PagedResult<StaffUserDto>
        {
            Items = data.Items.Select(MapStaff).ToList(),
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = data.Total
        });
    }

    public async Task<ActionResult<StaffUserDto>> Get(int id)
    {
        var user = await _repository.GetStaffAsync(id, tracking: false)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy tài khoản.");
        return Ok(MapStaff(user));
    }

    public async Task<ActionResult<TempCredentialResponse>> Create(CreateStaffRequest req)
    {
        var requested = NormalizeRequestedRoles(req.Role, req.Roles);
        ValidateStaffRoles(requested);
        await EnsureRolesExistAndActive(requested);

        if (requested.Contains(Roles.Doctor, StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(req.LicenseNo))
            throw AppException.BadRequest(Msg.LicenseRequired, "Bác sĩ phải có số chứng chỉ hành nghề.");

        var email = req.Email.Trim().ToLowerInvariant();
        if (await _repository.ActiveEmailExistsAsync(email))
            throw AppException.Conflict(Msg.PhoneTaken, "Email đã được sử dụng cho tài khoản khác.");

        var temp = _hasher.GenerateTempPassword() + "Aa";
        var user = new User
        {
            Email = email,
            PasswordHash = _hasher.Hash(temp),
            FullName = req.FullName.Trim(),
            LicenseNo = req.LicenseNo?.Trim(),
            MustChangePassword = true,
            IsActive = true
        };

        await _repository.ExecuteInTransactionAsync(async () =>
        {
            _repository.Add(user);
            await _repository.CommitAsync(); // cần Id để tạo UserRoles
            await _repository.SyncUserRolesAsync(user, requested, _me.Id);

            await _audit.LogAsync(AuditAction.UserCreate, nameof(User), user.Id,
                null, new { user.Email, Roles = requested, user.FullName });
            await _repository.CommitAsync();
        });

        return Ok(new TempCredentialResponse
        {
            LoginId = email,
            TempPassword = temp,
            Note = "Mật khẩu tạm chỉ hiển thị một lần. Người dùng phải đổi ở lần đăng nhập đầu.",
            RowVersion = user.ToRowVersion()
        });
    }

    public async Task<IActionResult> Update(int id, UpdateStaffRequest req)
    {
        var staff = await _repository.GetStaffAsync(id, tracking: true)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy tài khoản.");
        var user = staff.User;
        _repository.ApplyOriginalRowVersion(user, req.RowVersion);

        var currentRoles = staff.Roles.ToArray();
        var currentStaffRoles = currentRoles
            .Where(IsStaffRole)
            .ToArray();
        var requestedStaffRoles = req.Roles is { Count: > 0 }
            ? NormalizeRequestedRoles(null, req.Roles)
            : currentStaffRoles;

        ValidateStaffRoles(requestedStaffRoles);
        await EnsureRolesExistAndActive(requestedStaffRoles);

        // API quản lý nhân viên chỉ thay đổi các role nhân viên. Những role khác
        // đang active (ví dụ Patient) được giữ nguyên để hỗ trợ một User nhiều Role.
        var preservedRoles = currentRoles.Where(r => !IsStaffRole(r));
        var desiredRoles = requestedStaffRoles
            .Concat(preservedRoles)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (desiredRoles.Contains(Roles.Doctor, StringComparer.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(req.LicenseNo))
            throw AppException.BadRequest(Msg.LicenseRequired, "Bác sĩ phải có số chứng chỉ hành nghề.");

        if (user.IsActive
            && currentStaffRoles.Contains(Roles.Admin, StringComparer.OrdinalIgnoreCase)
            && !requestedStaffRoles.Contains(Roles.Admin, StringComparer.OrdinalIgnoreCase)
            && await _repository.CountOtherActiveUsersInRoleAsync(user.Id, Roles.Admin) == 0)
        {
            throw AppException.BadRequest(Msg.Forbidden,
                "Không thể gỡ vai trò Admin khỏi quản trị viên cuối cùng còn hoạt động.");
        }

        var before = new { user.FullName, user.LicenseNo, Roles = currentRoles };
        user.FullName = req.FullName.Trim();
        user.LicenseNo = req.LicenseNo?.Trim();
        user.UpdatedAt = DateTime.UtcNow;

        await _repository.SyncUserRolesAsync(user, desiredRoles, _me.Id);
        await _audit.LogAsync(AuditAction.UserUpdate, nameof(User), user.Id, before,
            new { user.FullName, user.LicenseNo, Roles = desiredRoles });
        await _repository.CommitAsync();

        return Ok(new { message = "Cập nhật thông tin thành công.", rowVersion = user.ToRowVersion() });
    }

    public async Task<IActionResult> SetActive(int id, bool value, ConcurrencyRequest req)
    {
        var staff = await _repository.GetStaffAsync(id, tracking: true)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy tài khoản.");
        var user = staff.User;
        _repository.ApplyOriginalRowVersion(user, req.RowVersion);

        if (user.Id == _me.Id && !value)
            throw AppException.BadRequest(Msg.Forbidden, "Không thể tự khóa tài khoản đang đăng nhập.");

        if (!value
            && staff.Roles.Contains(Roles.Admin, StringComparer.OrdinalIgnoreCase)
            && await _repository.CountOtherActiveUsersInRoleAsync(user.Id, Roles.Admin) == 0)
        {
            throw AppException.BadRequest(Msg.Forbidden,
                "Không thể khóa quản trị viên cuối cùng còn hoạt động.");
        }

        var old = user.IsActive;
        user.IsActive = value;
        user.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.UserLock, nameof(User), user.Id,
            new { isActive = old }, new { isActive = value });
        await _repository.CommitAsync();

        return Ok(new
        {
            message = value ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.",
            rowVersion = user.ToRowVersion()
        });
    }

    public async Task<ActionResult<TempCredentialResponse>> ResetPassword(int id, ConcurrencyRequest req)
    {
        var staff = await _repository.GetStaffAsync(id, tracking: true)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy tài khoản.");
        var user = staff.User;
        _repository.ApplyOriginalRowVersion(user, req.RowVersion);

        var temp = _hasher.GenerateTempPassword() + "Aa";
        user.PasswordHash = _hasher.Hash(temp);
        user.MustChangePassword = true;
        user.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.PasswordReset, nameof(User), user.Id,
            detail: "Quản trị viên đặt lại mật khẩu");
        await _repository.CommitAsync();

        return Ok(new TempCredentialResponse
        {
            LoginId = user.Email ?? "",
            TempPassword = temp,
            Note = "Mật khẩu tạm chỉ hiển thị một lần.",
            RowVersion = user.ToRowVersion()
        });
    }

    public async Task<IActionResult> Doctors()
    {
        var doctors = await _repository.GetActiveUsersInRoleAsync(Roles.Doctor);
        return Ok(doctors.Select(u => new { u.Id, u.FullName, u.LicenseNo }).ToList());
    }

    private async Task EnsureRolesExistAndActive(IReadOnlyCollection<string> requested)
    {
        var rows = await _repository.GetActiveRoleNamesByNamesAsync(requested);
        var found = rows.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missing = requested.Where(x => !found.Contains(x)).ToArray();
        if (missing.Length > 0)
            throw AppException.BadRequest(Msg.InvalidData,
                $"Role không tồn tại hoặc đang bị khóa trong database: {string.Join(", ", missing)}.");
    }

    private static string[] NormalizeRequestedRoles(string? role, IEnumerable<string>? roles)
    {
        var source = roles?.Where(x => !string.IsNullOrWhiteSpace(x)).ToArray();
        if (source is null or { Length: 0 })
            source = string.IsNullOrWhiteSpace(role) ? Array.Empty<string>() : new[] { role! };
        return source.Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static bool IsStaffRole(string role) =>
        Roles.StaffAssignable.Contains(role, StringComparer.OrdinalIgnoreCase);

    private static void ValidateStaffRoles(IReadOnlyCollection<string> roles)
    {
        if (roles.Count == 0 || roles.Any(r => !Roles.StaffAssignable.Contains(r, StringComparer.OrdinalIgnoreCase)))
            throw AppException.BadRequest(Msg.RequiredFields,
                "Vai trò nhân viên chỉ có thể là Admin, Doctor hoặc Receptionist.");
    }

    private static StaffUserDto MapStaff(StaffUserData staff)
    {
        var user = staff.User;
        var roles = staff.Roles.ToList();
        return new StaffUserDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = Roles.Primary(roles),
            Roles = roles,
            LicenseNo = user.LicenseNo,
            IsActive = user.IsActive,
            LastLoginAt = user.LastLoginAt,
            CreatedAt = user.CreatedAt,
            RowVersion = user.ToRowVersion()
        };
    }
}
