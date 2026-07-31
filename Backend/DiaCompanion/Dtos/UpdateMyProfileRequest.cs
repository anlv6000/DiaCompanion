using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

/// <summary>UC-17: bệnh nhân chỉ sửa được liên hệ, không sửa dữ liệu lâm sàng.</summary>
public class UpdateMyProfileRequest
{
    [Required, MaxLength(200)] public string FullName { get; set; } = "";
    public byte Gender { get; set; }
    [Required] public DateOnly DateOfBirth { get; set; }
    [Required, MaxLength(20)] public string Phone { get; set; } = "";
    [MaxLength(300)] public string? Address { get; set; }
    public byte DiabetesType { get; set; }
    public short? DiabetesDurationYears { get; set; }
    public decimal? BaselineHbA1c { get; set; }

}
