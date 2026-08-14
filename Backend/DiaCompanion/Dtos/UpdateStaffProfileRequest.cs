using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

/// <summary>
/// Doctor/Receptionist tự cập nhật hồ sơ cá nhân.
/// Email và role không được đổi tại đây vì là thông tin đăng nhập/phân quyền do Admin quản lý.
/// </summary>
public class UpdateStaffProfileRequest
{
    [Required(ErrorMessage = "Vui lòng nhập họ tên.")]
    [MaxLength(200, ErrorMessage = "Họ tên không được vượt quá 200 ký tự.")]
    public string FullName { get; set; } = "";

    [Required(ErrorMessage = "Vui lòng nhập số điện thoại.")]
    [RegularExpression(@"^\d{10,11}$", ErrorMessage = "Số điện thoại phải gồm 10 đến 11 chữ số.")]
    public string Phone { get; set; } = "";

    [MaxLength(50, ErrorMessage = "Số chứng chỉ hành nghề không được vượt quá 50 ký tự.")]
    public string? LicenseNo { get; set; }

    [Required(ErrorMessage = "Thiếu phiên bản dữ liệu. Vui lòng tải lại trang.")]
    public string RowVersion { get; set; } = "";
}
