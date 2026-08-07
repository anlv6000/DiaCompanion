using Microsoft.AspNetCore.Mvc;
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

    public AuthService(
        IRepository repository,
        IPasswordHasher hasher,
        IJwtTokenService jwt,
        IOtpService otp,
        IAuditService audit,
        ICurrentUser me)
    {
        _repository = repository;
        _hasher = hasher;
        _jwt = jwt;
        _otp = otp;
        _audit = audit;
        _me = me;
    }

    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) && string.IsNullOrWhiteSpace(req.Phone))
            throw AppException.BadRequest(Msg.RequiredFields, "Vui lòng nhập email hoặc số điện thoại.");

        var auth = await _repository.GetUserByLoginAsync(req.Email, req.Phone);
        var user = auth?.User;

        if (user is null || !_hasher.Verify(req.Password, user.PasswordHash))
        {
            await _audit.LogAsync(AuditAction.LoginFailed, "User", user?.Id,
                detail: $"Đăng nhập thất bại: {req.Email ?? req.Phone}");
            await _repository.CommitAsync();
            throw AppException.Unauthorized(Msg.BadCredentials, "Tài khoản đăng nhập hoặc mật khẩu không đúng.");
        }

        EnsureAccountCanAuthenticate(auth!);
        return await IssueTokenAsync(auth!);
    }

    public async Task<IActionResult> RequestOtp(RequestOtpRequest req, [FromServices] IWebHostEnvironment env)
    {
        var auth = await _repository.GetActiveUserByPhoneAsync(req.Phone);

        // Không để lộ số điện thoại nào đã đăng ký. OTP đăng nhập chỉ áp dụng
        // cho tài khoản có role Patient đang active trong DB.
        if (auth is null || !auth.Roles.Contains(Roles.Patient, StringComparer.OrdinalIgnoreCase))
            return Ok(new { message = "Nếu số điện thoại đã đăng ký, mã xác minh sẽ được cấp." });

        var code = await _otp.IssueAsync(req.Phone, OtpPurpose.Login, issuedBy: null);
        await _audit.LogAsync(AuditAction.OtpIssued, "User", auth.User.Id, detail: "Cấp OTP đăng nhập");
        await _repository.CommitAsync();

        return Ok(new
        {
            message = "Nếu số điện thoại đã đăng ký, mã xác minh sẽ được cấp.",
            devCode = env.IsDevelopment() ? code : null,
            note = env.IsDevelopment()
                ? "Chỉ hiển thị ở môi trường Development. Bản triển khai thật cần cổng SMS."
                : null
        });
    }

    public async Task<ActionResult<LoginResponse>> LoginOtp(OtpLoginRequest req)
    {
        var auth = await _repository.GetActiveUserByPhoneAsync(req.Phone);
        if (auth is null || !auth.Roles.Contains(Roles.Patient, StringComparer.OrdinalIgnoreCase))
            throw AppException.Unauthorized(Msg.BadCredentials, "Số điện thoại hoặc mã xác minh không đúng.");

        if (!await _otp.VerifyAsync(req.Phone, req.Code, OtpPurpose.Login))
            throw AppException.Unauthorized(Msg.OtpInvalid, "Mã xác minh không đúng hoặc đã hết hạn.");

        EnsureAccountCanAuthenticate(auth);
        return await IssueTokenAsync(auth);
    }

    public async Task<ActionResult<LoginResponse>> Refresh(RefreshTokenRequest req)
    {
        var userId = _jwt.ValidateRefreshToken(req.RefreshToken)
            ?? throw AppException.Unauthorized(Msg.SessionExpired, "Refresh token không hợp lệ hoặc đã hết hạn.");

        // Quan trọng: không dùng role nằm trong token cũ. Mỗi lần refresh đều
        // đọc lại User + Roles/UserRoles đang active từ database.
        var auth = await _repository.GetAuthUserByIdAsync(userId)
            ?? throw AppException.Unauthorized(Msg.SessionExpired, "Tài khoản không còn tồn tại.");

        EnsureAccountCanAuthenticate(auth);
        return await IssueTokenAsync(auth, updateLastLogin: false);
    }

    public async Task<IActionResult> ForgotPassword(RequestOtpRequest req, [FromServices] IWebHostEnvironment env)
    {
        var auth = await _repository.GetActiveUserByPhoneAsync(req.Phone);
        if (auth is null)
            return Ok(new { message = "Nếu số điện thoại đã đăng ký, mã xác minh sẽ được cấp." });

        var code = await _otp.IssueAsync(req.Phone, OtpPurpose.ResetPassword, issuedBy: null);
        await _repository.CommitAsync();
        return Ok(new { message = "Đã cấp mã xác minh.", devCode = env.IsDevelopment() ? code : null });
    }

    public async Task<IActionResult> ResetPassword(ResetPasswordRequest req)
    {
        _hasher.EnsureStrong(req.NewPassword);

        var auth = await _repository.GetActiveUserByPhoneAsync(req.Phone)
            ?? throw AppException.BadRequest(Msg.OtpInvalid, "Mã xác minh không đúng hoặc đã hết hạn.");

        if (!await _otp.VerifyAsync(req.Phone, req.Code, OtpPurpose.ResetPassword))
            throw AppException.BadRequest(Msg.OtpInvalid, "Mã xác minh không đúng hoặc đã hết hạn.");

        var user = auth.User;
        user.PasswordHash = _hasher.Hash(req.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.PasswordReset, "User", user.Id, detail: "Đặt lại mật khẩu qua OTP");
        await _repository.CommitAsync();
        return Ok(new { message = "Đặt lại mật khẩu thành công." });
    }

    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        _hasher.EnsureStrong(req.NewPassword);

        var id = _me.RequireId();
        var auth = await _repository.GetAuthUserByIdAsync(id)
            ?? throw AppException.Unauthorized(Msg.SessionExpired, "Phiên đăng nhập đã hết hạn.");
        EnsureAccountCanAuthenticate(auth);

        var user = auth.User;
        var wasTemporaryPassword = user.MustChangePassword;
        if (!wasTemporaryPassword)
        {
            if (string.IsNullOrWhiteSpace(req.CurrentPassword))
                throw AppException.BadRequest(Msg.RequiredFields, "Vui lòng nhập mật khẩu hiện tại.");
            if (!_hasher.Verify(req.CurrentPassword, user.PasswordHash))
                throw AppException.BadRequest(Msg.BadCredentials, "Mật khẩu hiện tại không đúng.");
        }

        user.PasswordHash = _hasher.Hash(req.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(
            AuditAction.PasswordChange,
            "User",
            user.Id,
            detail: wasTemporaryPassword ? "Đổi mật khẩu tạm lần đầu" : "Đổi mật khẩu chủ động");
        await _repository.CommitAsync();

        return Ok(new
        {
            message = "Đổi mật khẩu thành công.",
            mustChangePassword = false,
            defaultRoute = Roles.DefaultRoute(auth.Roles)
        });
    }

    public async Task<IActionResult> Logout()
    {
        await _audit.LogAsync(AuditAction.Logout, "User", _me.Id);
        await _repository.CommitAsync();
        return Ok(new { message = "Đã đăng xuất." });
    }

    public async Task<ActionResult<LoginResponse>> Me()
    {
        var auth = await _repository.GetAuthUserByIdAsync(_me.RequireId())
            ?? throw AppException.Unauthorized(Msg.SessionExpired, "Phiên đăng nhập đã hết hạn.");
        EnsureAccountCanAuthenticate(auth);
        return Ok(ToResponse(auth, token: "", expiresAt: default, refreshToken: "", refreshExpiresAt: default));
    }

    private async Task<ActionResult<LoginResponse>> IssueTokenAsync(AuthUserData auth, bool updateLastLogin = true)
    {
        var token = _jwt.CreateAccessToken(auth.User, auth.Roles, auth.PatientId, out var expiresAt);
        var refreshToken = _jwt.CreateRefreshToken(auth.User.Id, out var refreshExpiresAt);

        if (updateLastLogin)
        {
            auth.User.LastLoginAt = DateTime.UtcNow;
            await _audit.LogAsync(AuditAction.Login, "User", auth.User.Id);
            await _repository.CommitAsync();
        }

        return Ok(ToResponse(auth, token, expiresAt, refreshToken, refreshExpiresAt));
    }

    private static LoginResponse ToResponse(
        AuthUserData auth,
        string token,
        DateTime expiresAt,
        string refreshToken,
        DateTime refreshExpiresAt) => new()
    {
        Token = token,
        ExpiresAt = expiresAt,
        RefreshToken = refreshToken,
        RefreshTokenExpiresAt = refreshExpiresAt,
        UserId = auth.User.Id,
        FullName = auth.User.FullName,
        Role = Roles.Primary(auth.Roles),
        Roles = auth.Roles.ToList(),
        PatientId = auth.PatientId,
        MustChangePassword = auth.User.MustChangePassword,
        DefaultRoute = Roles.DefaultRoute(auth.Roles)
    };

    private static void EnsureAccountCanAuthenticate(AuthUserData auth)
    {
        if (!auth.User.IsActive)
            throw AppException.Unauthorized(Msg.AccountLocked, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
        if (auth.Roles.Count == 0)
            throw AppException.Unauthorized(Msg.Forbidden, "Tài khoản hiện không có vai trò đang hoạt động.");
    }
}
