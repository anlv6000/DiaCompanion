using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class PrescriptionItemInput
{
    [Required, MaxLength(200)] public string DrugName { get; set; } = "";
    [Required, MaxLength(100)] public string Dose { get; set; } = "";
    [Range(1, 6)] public byte TimesPerDay { get; set; } = 1;
    [Range(1, 365)] public short DurationDays { get; set; } = 30;
    [MaxLength(300)] public string? Instruction { get; set; }
}
