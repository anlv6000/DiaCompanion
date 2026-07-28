using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CreateMetricRequest
{
    [Required] public MetricType MetricType { get; set; }
    [Required] public decimal Value { get; set; }
    public MetricContext? Context { get; set; }
    /// <summary>Bỏ trống thì lấy thời điểm hiện tại. Cho phép ghi bù ngày trước.</summary>
    public DateTime? RecordedAtUtc { get; set; }
    [MaxLength(300)] public string? Note { get; set; }
}
