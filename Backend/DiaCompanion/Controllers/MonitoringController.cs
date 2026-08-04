using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-41..47 — chỉ số sức khỏe, lối sống và xác nhận dùng thuốc.</summary>
[Route("api/monitoring")]
public class MonitoringController : BaseApiController
{
    private readonly IMonitoringService _service;
    public MonitoringController(IMonitoringService service) => _service = service;

    [HttpGet("metrics")]
    public async Task<ActionResult<KeysetResult<HealthMetricDto>>> Metrics(
        [FromQuery] int? patientId,
        [FromQuery] MetricType? type,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] string? cursor,
        [FromQuery] int size = 50) =>
        await _service.Metrics(patientId, type, from, to, cursor, size);

    [HttpPost("metrics")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<HealthMetricDto>> CreateMetric(CreateMetricRequest req) =>
        await _service.CreateMetric(req);

    [HttpPut("metrics/{id:int}")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<IActionResult> UpdateMetric(int id, CreateMetricRequest req) =>
        await _service.UpdateMetric(id, req);

    [HttpDelete("metrics/{id:int}")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<IActionResult> DeleteMetric(int id, ConcurrencyRequest req) =>
        await _service.DeleteMetric(id, req);

    [HttpGet("metrics/summary/{patientId:int}")]
    public async Task<ActionResult<MetricSummaryDto>> Summary(int patientId, [FromQuery] int days = 30) =>
        await _service.Summary(patientId, days);

    [HttpGet("lifestyle")]
    public async Task<ActionResult<List<LifestyleLogDto>>> Lifestyle(
        [FromQuery] int? patientId,
        [FromQuery] int days = 14) =>
        await _service.Lifestyle(patientId, days);

    [HttpPost("lifestyle")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<LifestyleLogDto>> CreateLifestyle(CreateLifestyleRequest req) =>
        await _service.CreateLifestyle(req);

    [HttpPut("lifestyle/{id:int}")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<LifestyleLogDto>> UpdateLifestyle(int id, CreateLifestyleRequest req) =>
        await _service.UpdateLifestyle(id, req);

    [HttpDelete("lifestyle/{id:int}")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<IActionResult> DeleteLifestyle(int id, ConcurrencyRequest req) =>
        await _service.DeleteLifestyle(id, req);

    [HttpGet("medications/today")]
    public async Task<ActionResult<List<MedicationLogDto>>> Today([FromQuery] int? patientId) =>
        await _service.Today(patientId);

    [HttpPut("medications/{id:int}/status")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<MedicationLogDto>> UpdateMedicationStatus(
        int id,
        UpdateMedicationStatusRequest req) =>
        await _service.UpdateMedicationStatus(id, req);
}
