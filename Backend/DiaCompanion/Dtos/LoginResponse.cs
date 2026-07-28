using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class LoginResponse
{
    public string Token { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public int UserId { get; set; }
    public string FullName { get; set; } = "";
    public string Role { get; set; } = "";
    public int? PatientId { get; set; }
    /// <summary>Giao diện phải ép đổi mật khẩu trước khi cho vào các màn khác.</summary>
    public bool MustChangePassword { get; set; }
    public string DefaultRoute { get; set; } = "";
}
