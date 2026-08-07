using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class CreateStaffRequest
{
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required, MaxLength(200)] public string FullName { get; set; } = "";

    /// <summary>Giữ tương thích client cũ gửi một role.</summary>
    public string? Role { get; set; }

    /// <summary>Hỗ trợ một user có nhiều role. Nếu có giá trị thì ưu tiên trường này.</summary>
    public List<string>? Roles { get; set; }

    public string? LicenseNo { get; set; }
}
