using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

/* ============================ VISITS (UC-18..21) ========================= */

public class VisitDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string PatientCode { get; set; } = "";
    public int? DoctorId { get; set; }
    public string? DoctorName { get; set; }
    public DateTime VisitDate { get; set; }
    public byte Status { get; set; }
    public string? Conclusion { get; set; }
    public byte? Referral { get; set; }
    public byte? RecheckMonths { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int ImageCount { get; set; }
    public int PendingReviewCount { get; set; }
}
