using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class ChangePasswordRequest
{
    /// <summary>
    /// Bắt buộc khi đổi mật khẩu chủ động.
    /// Được phép bỏ trống khi tài khoản đang ở trạng thái MustChangePassword.
    /// </summary>
    public string? CurrentPassword { get; set; }

    [Required]
    public string NewPassword { get; set; } = "";
}
