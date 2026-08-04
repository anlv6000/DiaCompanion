using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CreatePatientRequest
{
    [Required, MaxLength(200)] public string FullName { get; set; } = "";
    public byte? Gender { get; set; }
    [Required] public DateOnly DateOfBirth { get; set; }
    /// <summary>LI-6: bắt buộc và duy nhất — đây là định danh đăng nhập của bệnh nhân.</summary>
    [Required, MaxLength(20)] public string Phone { get; set; } = "";
    [MaxLength(300)] public string? Address { get; set; }
    public byte DiabetesType { get; set; } = 2;
    public short? DiabetesDurationYears { get; set; }
    public decimal? BaselineHbA1c { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }
    /// <summary>Mặc định true: tài khoản được cấp ngay lúc tạo hồ sơ.</summary>
    public bool CreateAccount { get; set; } = true;
}
