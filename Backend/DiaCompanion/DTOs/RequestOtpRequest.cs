using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class RequestOtpRequest
{
    [Required] public string Phone { get; set; } = "";
}
