using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CreatePrescriptionRequest
{
    [Required] public int PatientId { get; set; }
    public int? VisitId { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }
    [Required, MinLength(1)] public List<PrescriptionItemInput> Items { get; set; } = new();
}
