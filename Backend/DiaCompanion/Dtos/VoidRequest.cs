using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class VoidRequest
{
    [Required, MaxLength(500)] public string Reason { get; set; } = "";
    [Required]
    public string RowVersion { get; set; } = "";
}
