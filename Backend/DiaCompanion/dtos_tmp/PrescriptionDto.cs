using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

/* ========================= PRESCRIPTION (UC-36..40) ===================== */

public class PrescriptionDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public int? VisitId { get; set; }
    public string DoctorName { get; set; } = "";
    public DateTime IssuedAt { get; set; }
    public string? Note { get; set; }
    public List<PrescriptionItemDto> Items { get; set; } = new();
}
