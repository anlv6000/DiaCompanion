using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class UpdateStaffRequest
{
    [Required, MaxLength(200)] public string FullName { get; set; } = "";
    public string? LicenseNo { get; set; }

    /// <summary>Role staff mới. Chỉ Doctor hoặc Receptionist.</summary>
    public string? Role { get; set; }

    /// <summary>Tương thích FE cũ; nếu gửi thì chỉ được chứa đúng một role staff.</summary>
    public List<string>? Roles { get; set; }

    [Required] public string RowVersion { get; set; } = "";
}
