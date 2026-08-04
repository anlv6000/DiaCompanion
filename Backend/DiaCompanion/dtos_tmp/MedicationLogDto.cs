using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class MedicationLogDto
{
    public int Id { get; set; }
    public string DrugName { get; set; } = "";
    public string Dose { get; set; } = "";
    public DateTime ScheduledAt { get; set; }
    public DateTime? TakenAt { get; set; }
    public byte Status { get; set; }
}
