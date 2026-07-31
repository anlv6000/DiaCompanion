using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

/// <summary>UC-01 phương thức 2: bệnh nhân đăng nhập bằng OTP.</summary>
public class OtpLoginRequest
{
    [Required] public string Phone { get; set; } = "";
    [Required] public string Code { get; set; } = "";
}
