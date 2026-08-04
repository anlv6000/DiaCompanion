using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class ResetPasswordRequest
{
    [Required] public string Phone { get; set; } = "";
    [Required] public string Code { get; set; } = "";
    [Required] public string NewPassword { get; set; } = "";
}
