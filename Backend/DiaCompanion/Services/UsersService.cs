using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    /// <summary>UC-06 — danh sách tài khoản nhân viên.</summary>
    public async Task<ActionResult<PagedResult<StaffUserDto>>> List(
        [FromQuery] string? q, [FromQuery] UserRole? role, [FromQuery] bool? isActive,
        [FromQuery] PageQuery page)
    {
        // Bệnh nhân không thuộc màn quản lý tài khoản nhân viên
        var query = _repository.Users.AsNoTracking().Where(u => u.Role != UserRole.Patient);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var norm = VietnameseText.RemoveDiacritics(q);
            query = query.Where(u => EF.Functions.Like(u.FullName, $"%{q}%")
                                  || EF.Functions.Like(u.Email!, $"%{q}%")
                                  || EF.Functions.Like(u.LicenseNo!, $"%{norm}%"));
        }
        if (role is UserRole r) query = query.Where(u => u.Role == r);
        if (isActive is bool act) query = query.Where(u => u.IsActive == act);

        var total = await query.CountAsync();

        query = (page.Sort, page.Desc) switch
        {
            ("name", false) => query.OrderBy(u => u.FullName),
            ("name", true) => query.OrderByDescending(u => u.FullName),
            ("lastLogin", true) => query.OrderByDescending(u => u.LastLoginAt),
            _ => query.OrderBy(u => u.Role).ThenBy(u => u.FullName)
        };

        var rows = await query.Skip(page.Skip).Take(page.PageSize).ToListAsync();
        var items = rows.Select(MapStaff).ToList();

        return Ok(new PagedResult<StaffUserDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }

    /// <summary>UC-07 — chi tiết tài khoản.</summary>
    public async Task<ActionResult<StaffUserDto>> Get(int id)
    {
        var user = await _repository.Users.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.Role != UserRole.Patient)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy tài khoản.");
        return Ok(MapStaff(user));
    }

    /// <summary>UC-08 — tạo tài khoản Admin, Bác sĩ hoặc Lễ tân.</summary>
    public async Task<ActionResult<TempCredentialResponse>> Create(CreateStaffRequest req)
    {
        if (req.Role is not (UserRole.Admin or UserRole.Doctor or UserRole.Receptionist))
            throw AppException.BadRequest(Msg.RequiredFields,
                "Vai trò nhân viên chỉ có thể là Admin, Bác sĩ hoặc Lễ tân.");

        // BR-10 — kiểm ở tầng ứng dụng để có thông điệp rõ; CK_Users_License là chốt cuối
        if (req.Role == UserRole.Doctor && string.IsNullOrWhiteSpace(req.LicenseNo))
            throw AppException.BadRequest(Msg.LicenseRequired, "Bác sĩ phải có số chứng chỉ hành nghề.");

        var email = req.Email.Trim().ToLowerInvariant();
        if (await _repository.Users.AnyAsync(u => u.Email == email && u.IsActive))
            throw AppException.Conflict(Msg.PhoneTaken, "Email đã được sử dụng cho tài khoản khác.");

        var temp = _hasher.GenerateTempPassword() + "Aa";  // đủ mạnh theo quy tắc chữ + số
        var user = new User
        {
            Email = email,
            PasswordHash = _hasher.Hash(temp),
            Role = req.Role,
            FullName = req.FullName.Trim(),
            LicenseNo = req.LicenseNo?.Trim(),
            MustChangePassword = true,
            IsActive = true
        };

        _repository.Users.Add(user);
        await _repository.SaveChangesAsync();

        await _audit.LogAsync(AuditAction.UserCreate, nameof(User), user.Id,
            null, new { user.Email, Role = user.Role.ToString(), user.FullName });
        await _repository.SaveChangesAsync();

        return Ok(new TempCredentialResponse
        {
            LoginId = email,
            TempPassword = temp,
            Note = "Mật khẩu tạm chỉ hiển thị một lần. Người dùng phải đổi ở lần đăng nhập đầu.",
            RowVersion = user.ToRowVersion()
        });
    }

    /// <summary>UC-09 — cập nhật tài khoản.</summary>
    public async Task<IActionResult> Update(int id, UpdateStaffRequest req)
    {
        var u = await _repository.Users.FirstOrDefaultAsync(x => x.Id == id && x.Role != UserRole.Patient)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy tài khoản.");

        _repository.ApplyOriginalRowVersion(u, req.RowVersion);

        if (u.Role == UserRole.Doctor && string.IsNullOrWhiteSpace(req.LicenseNo))
            throw AppException.BadRequest(Msg.LicenseRequired, "Bác sĩ phải có số chứng chỉ hành nghề.");

        var before = new { u.FullName, u.LicenseNo };
        u.FullName = req.FullName.Trim();
        u.LicenseNo = req.LicenseNo?.Trim();
        u.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.UserUpdate, nameof(User), u.Id, before,
            new { u.FullName, u.LicenseNo });
        await _repository.SaveChangesAsync();
        return Ok(new
        {
            message = "Cập nhật thông tin thành công.",
            rowVersion = u.ToRowVersion()
        });
    }

    /// <summary>
    /// UC-10 — khoá / mở tài khoản.
    /// BR-11: tài khoản KHÔNG bị xoá, chỉ khoá — để giữ vết các thao tác đã thực hiện.
    /// </summary>
    public async Task<IActionResult> SetActive(int id, bool value, ConcurrencyRequest req)
    {
        var u = await _repository.Users.FirstOrDefaultAsync(x => x.Id == id && x.Role != UserRole.Patient)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy tài khoản.");

        _repository.ApplyOriginalRowVersion(u, req.RowVersion);

        // Tự khoá mình sẽ đẩy admin ra khỏi hệ thống và có thể không còn admin nào
        if (u.Id == _me.Id)
            throw AppException.BadRequest(Msg.Forbidden, "Không thể tự khóa tài khoản đang đăng nhập.");

        if (!value && u.Role == UserRole.Admin)
        {
            var remaining = await _repository.Users.CountAsync(x => x.Role == UserRole.Admin && x.IsActive && x.Id != u.Id);
            if (remaining == 0)
                throw AppException.BadRequest(Msg.Forbidden,
                    "Không thể khóa quản trị viên cuối cùng còn hoạt động.");
        }

        u.IsActive = value;
        u.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.UserLock, nameof(User), u.Id,
            new { isActive = !value }, new { isActive = value });
        await _repository.SaveChangesAsync();
        return Ok(new
        {
            message = value ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.",
            rowVersion = u.ToRowVersion()
        });
    }

    /// <summary>UC-11 — đặt lại mật khẩu cho nhân viên.</summary>
    public async Task<ActionResult<TempCredentialResponse>> ResetPassword(int id, ConcurrencyRequest req)
    {
        var u = await _repository.Users.FirstOrDefaultAsync(x => x.Id == id && x.Role != UserRole.Patient)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy tài khoản.");

        _repository.ApplyOriginalRowVersion(u, req.RowVersion);

        var temp = _hasher.GenerateTempPassword() + "Aa";
        u.PasswordHash = _hasher.Hash(temp);
        u.MustChangePassword = true;
        u.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.PasswordReset, nameof(User), u.Id,
            detail: "Quản trị viên đặt lại mật khẩu");
        await _repository.SaveChangesAsync();

        return Ok(new TempCredentialResponse
        {
            LoginId = u.Email ?? "",
            TempPassword = temp,
            Note = "Mật khẩu tạm chỉ hiển thị một lần.",
            RowVersion = u.ToRowVersion()
        });
    }

    /// <summary>Danh sách bác sĩ để đổ vào dropdown (dùng ở nhiều màn).</summary>
    public async Task<IActionResult> Doctors()
    {
        var list = await _repository.Users.AsNoTracking()
            .Where(u => u.Role == UserRole.Doctor && u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new { u.Id, u.FullName, u.LicenseNo })
            .ToListAsync();
        return Ok(list);
    }

    private static StaffUserDto MapStaff(User u) => new()
    {
        Id = u.Id,
        FullName = u.FullName,
        Email = u.Email,
        Role = u.Role.ToString(),
        LicenseNo = u.LicenseNo,
        IsActive = u.IsActive,
        LastLoginAt = u.LastLoginAt,
        CreatedAt = u.CreatedAt,
        RowVersion = u.ToRowVersion()
    };
}
