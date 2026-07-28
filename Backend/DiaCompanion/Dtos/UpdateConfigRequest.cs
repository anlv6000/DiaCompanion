using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class UpdateConfigRequest
{
    [Required] public string Value { get; set; } = "";
}
