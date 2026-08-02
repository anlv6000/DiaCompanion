using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

public interface IMonitoringService
{
    Task<ActionResult<KeysetResult<HealthMetricDto>>> Metrics(
        [FromQuery] int? patientId, [FromQuery] MetricType? type,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] string? cursor, [FromQuery] int size = 50);
    Task<ActionResult<HealthMetricDto>> CreateMetric(CreateMetricRequest req);
    Task<IActionResult> UpdateMetric(int id, CreateMetricRequest req);
    Task<IActionResult> DeleteMetric(int id, ConcurrencyRequest req);
    Task<ActionResult<MetricSummaryDto>> Summary(int patientId, [FromQuery] int days = 30);
    Task<ActionResult<List<LifestyleLogDto>>> Lifestyle(
        [FromQuery] int? patientId, [FromQuery] int days = 14);
    Task<ActionResult<LifestyleLogDto>> CreateLifestyle(CreateLifestyleRequest req);
    Task<IActionResult> DeleteLifestyle(int id, ConcurrencyRequest req);
    Task<ActionResult<List<MedicationLogDto>>> Today([FromQuery] int? patientId);
    Task<IActionResult> ConfirmTaken(int id, [FromQuery] bool taken = true);
}
