using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

/// <summary>
/// Bệnh nhân tự cập nhật thông tin cá nhân không nhạy cảm.
/// Số điện thoại được đổi qua luồng OTP riêng; dữ liệu lâm sàng không được sửa tại đây.
/// </summary>
public class UpdateMyProfileRequest
{
    
    [Required, MaxLength(200, ErrorMessage = "Họ và tên không được vượt quá 200 ký tự.")]
    public string FullName { get; set; } = "";

    [Range(0, 2, ErrorMessage = "giới tính chỉ được chọn là nam hoặc nữ.")]
    public byte Gender { get; set; }

    [Required]
    public DateOnly DateOfBirth { get; set; }

    [MaxLength(300)]
    public string? Address { get; set; }

    [Required]
    public string RowVersion { get; set; } = "";
}
