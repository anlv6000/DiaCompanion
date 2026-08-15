using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class CreateStaffRequest
{
    [Required(ErrorMessage = "Vui lòng nhập số điện thoại.")]
    [RegularExpression(
        @"^\d{10,11}$",
        ErrorMessage = "Số điện thoại phải gồm 10 đến 11 chữ số.")]
    public string Phone { get; set; } = "";

    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không đúng định dạng.")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "Vui lòng nhập họ tên.")]
    [MaxLength(70, ErrorMessage = "Họ tên không được vượt quá 70 ký tự.")]
    public string FullName { get; set; } = "";

    /// <summary>Role staff. Chỉ Doctor hoặc Receptionist.</summary>
    public string? Role { get; set; }

    /// <summary>Tương thích FE cũ; nếu gửi thì chỉ được chứa đúng một role staff.</summary>
    public List<string>? Roles { get; set; }

    public string? LicenseNo { get; set; }
}
