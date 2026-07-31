using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

/* ============================== AUTH (UC-01..05) ========================== */

/// <summary>UC-01. Nhân viên đăng nhập bằng email; bệnh nhân bằng số điện thoại.</summary>
public class LoginRequest
{
    public string? Email { get; set; }
    public string? Phone { get; set; }
    [Required] public string Password { get; set; } = "";
}
