using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

/// <summary>UC-17: bệnh nhân chỉ sửa được liên hệ, không sửa dữ liệu lâm sàng.</summary>
public class UpdateMyProfileRequest
{
    [MaxLength(300)] public string? Address { get; set; }
}
