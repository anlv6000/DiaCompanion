using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;

namespace DiaCompanion.Api.Services;

/// <summary>UC-01, UC-04, UC-05.</summary>
public class AuthService : BaseService, IAuthService
{
    private readonly IRepository _repository;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly IOtpService _otp;
    private readonly IAuditService _audit;
    private readonly ICurrentUser _me;

    public AuthService(IRepository repository, IPasswordHasher hasher, IJwtTokenService jwt,
                          IOtpService otp, IAuditService audit, ICurrentUser me)
    { _repository = repository; _hasher = hasher; _jwt = jwt; _otp = otp; _audit = audit; _me = me; }

    /// <summary>
    /// UC-01 — đăng nhập bằng mật khẩu.
    /// Nhân viên dùng email; bệnh nhân dùng SỐ ĐIỆN THOẠI (LI-6).
    /// </summary>
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) && string.IsNullOrWhiteSpace(req.Phone))
            throw AppException.BadRequest(Msg.RequiredFields, "Vui lòng nhập email hoặc số điện thoại.");

        var user = await _repository.Users.FirstOrDefaultAsync(u =>
            (req.Phone != null && u.Phone == req.Phone) ||
            (req.Email != null && u.Email == req.Email));

        // Cùng một thông điệp cho "không tồn tại" và "sai mật khẩu" — nếu phân biệt,
        // kẻ tấn công dò được số điện thoại nào đã đăng ký.
        if (user is null || !_hasher.Verify(req.Password, user.PasswordHash))
        {
            await _audit.LogAsync(AuditAction.LoginFailed, "User", user?.Id,
                detail: $"Đăng nhập thất bại: {req.Email ?? req.Phone}");
            await _repository.SaveChangesAsync();
            throw AppException.Unauthorized(Msg.BadCredentials, "Email hoặc mật khẩu không đúng.");
        }

        if (!user.IsActive)
            throw AppException.Unauthorized(Msg.AccountLocked, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");

        return await IssueTokenAsync(user);
    }

    /// <summary>
    /// UC-01 phương thức 2 — bệnh nhân yêu cầu mã OTP.
    ///
    /// PHẠM VI v1.0: hệ thống KHÔNG gửi SMS (LI-5). Mã được trả về cho nhân viên
    /// quầy tiếp đón đọc cho bệnh nhân, hoặc hiển thị trong môi trường Development.
    /// Khi có cổng SMS thì chỉ cần cắm ISmsSender vào OtpService.
    /// </summary>
    public async Task<IActionResult> RequestOtp(RequestOtpRequest req, [FromServices] IWebHostEnvironment env)
    {
        var user = await _repository.Users.FirstOrDefaultAsync(u => u.Phone == req.Phone && u.IsActive);

        // Luôn trả 200 dù số không tồn tại — tránh để lộ số nào đã đăng ký.
        if (user is null)
            return Ok(new { message = "Nếu số điện thoại đã đăng ký, mã xác minh sẽ được cấp." });

        var code = await _otp.IssueAsync(req.Phone, OtpPurpose.Login, issuedBy: null);
        await _audit.LogAsync(AuditAction.OtpIssued, "User", user.Id, detail: "Cấp OTP đăng nhập");
        await _repository.SaveChangesAsync();

        return Ok(new
        {
            message = "Nếu số điện thoại đã đăng ký, mã xác minh sẽ được cấp.",
            // Chỉ lộ mã ở môi trường phát triển — production phải qua SMS
            devCode = env.IsDevelopment() ? code : null,
            note = env.IsDevelopment()
                ? "Chỉ hiển thị ở môi trường Development. Bản triển khai thật cần cổng SMS."
                : null
        });
    }

    /// <summary>UC-01 phương thức 2 — đăng nhập bằng OTP.</summary>
    public async Task<ActionResult<LoginResponse>> LoginOtp(OtpLoginRequest req)
    {
        var user = await _repository.Users.FirstOrDefaultAsync(u => u.Phone == req.Phone);
        if (user is null || !user.IsActive)
            throw AppException.Unauthorized(Msg.BadCredentials, "Số điện thoại hoặc mã xác minh không đúng.");

        if (!await _otp.VerifyAsync(req.Phone, req.Code, OtpPurpose.Login))
            throw AppException.Unauthorized(Msg.OtpInvalid, "Mã xác minh không đúng hoặc đã hết hạn.");

        return await IssueTokenAsync(user);
    }

    /// <summary>UC-04 — quên mật khẩu, đặt lại bằng OTP.</summary>
    public async Task<IActionResult> ForgotPassword(RequestOtpRequest req, [FromServices] IWebHostEnvironment env)
    {
        var user = await _repository.Users.FirstOrDefaultAsync(u => u.Phone == req.Phone && u.IsActive);
        if (user is null) return Ok(new { message = "Nếu số điện thoại đã đăng ký, mã xác minh sẽ được cấp." });

        var code = await _otp.IssueAsync(req.Phone, OtpPurpose.ResetPassword, issuedBy: null);
        await _repository.SaveChangesAsync();
        return Ok(new { message = "Đã cấp mã xác minh.", devCode = env.IsDevelopment() ? code : null });
    }
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest req)
    {
        _hasher.EnsureStrong(req.NewPassword);

        var user = await _repository.Users.FirstOrDefaultAsync(u => u.Phone == req.Phone && u.IsActive)
            ?? throw AppException.BadRequest(Msg.OtpInvalid, "Mã xác minh không đúng hoặc đã hết hạn.");

        if (!await _otp.VerifyAsync(req.Phone, req.Code, OtpPurpose.ResetPassword))
            throw AppException.BadRequest(Msg.OtpInvalid, "Mã xác minh không đúng hoặc đã hết hạn.");

        user.PasswordHash = _hasher.Hash(req.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.PasswordReset, "User", user.Id, detail: "Đặt lại mật khẩu qua OTP");
        await _repository.SaveChangesAsync();
        return Ok(new { message = "Đặt lại mật khẩu thành công." });
    }

    /// <summary>UC-05 — đổi mật khẩu khi đã đăng nhập.</summary>
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        _hasher.EnsureStrong(req.NewPassword);

        var id = _me.RequireId();
        var user = await _repository.Users.FirstAsync(u => u.Id == id);

        if (!_hasher.Verify(req.CurrentPassword, user.PasswordHash))
            throw AppException.BadRequest(Msg.BadCredentials, "Mật khẩu hiện tại không đúng.");

        user.PasswordHash = _hasher.Hash(req.NewPassword);
        // Gỡ cờ mật khẩu tạm — đây là điều kiện để bệnh nhân vào được hồ sơ
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.PasswordChange, "User", user.Id);
        await _repository.SaveChangesAsync();
        return Ok(new { message = "Đổi mật khẩu thành công." });
    }
    public async Task<IActionResult> Logout()
    {
        await _audit.LogAsync(AuditAction.Logout, "User", _me.Id);
        await _repository.SaveChangesAsync();
        // JWT không thu hồi được phía server trong phạm vi v1.0; client xoá token.
        return Ok(new { message = "Đã đăng xuất." });
    }
    public async Task<ActionResult<LoginResponse>> Me()
    {
        var id = _me.RequireId();
        var user = await _repository.Users.FirstAsync(u => u.Id == id);
        var patientId = await _repository.Patients.Where(p => p.UserId == id).Select(p => (int?)p.Id).FirstOrDefaultAsync();

        return Ok(new LoginResponse
        {
            UserId = user.Id,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            PatientId = patientId,
            MustChangePassword = user.MustChangePassword,
            DefaultRoute = DefaultRoute(user.Role)
        });
    }

    private async Task<ActionResult<LoginResponse>> IssueTokenAsync(Entities.User user)
    {
        var patientId = await _repository.Patients
            .Where(p => p.UserId == user.Id).Select(p => (int?)p.Id).FirstOrDefaultAsync();

        var token = _jwt.Create(user, patientId, out var expiresAt);

        user.LastLoginAt = DateTime.UtcNow;
        await _audit.LogAsync(AuditAction.Login, "User", user.Id);
        await _repository.SaveChangesAsync();

        return Ok(new LoginResponse
        {
            Token = token,
            ExpiresAt = expiresAt,
            UserId = user.Id,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            PatientId = patientId,
            MustChangePassword = user.MustChangePassword,
            DefaultRoute = DefaultRoute(user.Role)
        });
    }

    /// <summary>UC-01 bước 7: mỗi vai trò vào thẳng màn hình làm việc của mình.</summary>
    private static string DefaultRoute(UserRole role) => role switch
    {
        UserRole.Doctor => "/triage",       // SCR-14
        UserRole.Admin => "/dashboard",     // SCR-19
        UserRole.Nurse => "/patients",      // SCR-06
        UserRole.Receptionist => "/reception/visits/new", // quầy tiếp đón
        _ => "/home"                        // MOB-03
    };
}
