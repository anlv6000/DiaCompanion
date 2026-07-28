using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

/* ========================= MONITORING (UC-46..52) ======================= */

public class HealthMetricDto
{
    public int Id { get; set; }
    public byte MetricType { get; set; }
    public decimal Value { get; set; }
    public string Unit { get; set; } = "";
    public byte? Context { get; set; }
    public DateTime RecordedAtUtc { get; set; }
    public DateOnly RecordedLocalDate { get; set; }
    public string? Note { get; set; }
    public bool IsAbnormal { get; set; }
}
