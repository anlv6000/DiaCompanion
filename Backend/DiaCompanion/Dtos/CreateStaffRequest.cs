using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class CreateStaffRequest
{
    [Required, MaxLength(20)] public string Phone { get; set; } = "";
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required, MaxLength(200)] public string FullName { get; set; } = "";

    /// <summary>Role staff. Chỉ Doctor hoặc Receptionist.</summary>
    public string? Role { get; set; }

    /// <summary>Tương thích FE cũ; nếu gửi thì chỉ được chứa đúng một role staff.</summary>
    public List<string>? Roles { get; set; }

    public string? LicenseNo { get; set; }
}
