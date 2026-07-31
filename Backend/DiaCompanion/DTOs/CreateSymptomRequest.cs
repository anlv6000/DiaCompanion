using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CreateSymptomRequest
{
    [Required, MaxLength(500)] public string Symptoms { get; set; } = "";
    [Required] public SymptomSeverity Severity { get; set; }
    [MaxLength(1000)] public string? Description { get; set; }
    [MaxLength(100)] public string? OnsetNote { get; set; }
}
