using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class UpdateStaffRequest
{
    [MaxLength(200, ErrorMessage = "Họ và tên không được vượt quá 200 ký tự.")]
    public string FullName { get; set; } = "";

    [MaxLength(50, ErrorMessage = "Chứng chỉ không được vượt quá 50 ký tự.")]
    public string? LicenseNo { get; set; }

    /// <summary>Role staff mới. Chỉ Doctor hoặc Receptionist.</summary>
    public string? Role { get; set; }

    /// <summary>Tương thích FE cũ; nếu gửi thì chỉ được chứa đúng một role staff.</summary>
    public List<string>? Roles { get; set; }

    [Required] public string RowVersion { get; set; } = "";
}
