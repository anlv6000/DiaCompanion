using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

/* ============================ ADMIN (UC-58, 63..66) ==================== */

public class DashboardDto
{
    public int TotalPatients { get; set; }
    public int VisitsThisMonth { get; set; }
    public int PendingTriage { get; set; }
    public int DeferredPending { get; set; }
    public decimal DeferralRate { get; set; }
    public decimal ReferralRate { get; set; }
    public decimal OverrideRate { get; set; }
    public Dictionary<string, int> GradeDistribution { get; set; } = new();
    public string ActiveModel { get; set; } = "";
}
