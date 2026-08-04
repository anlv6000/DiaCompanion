using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-53, UC-58..61 — thống kê và quản trị hệ thống.</summary>
[Route("api/admin")]
public class AdminController : BaseApiController
{
    private readonly IAdminService _service;
    public AdminController(IAdminService service) => _service = service;

    [HttpGet("dashboard")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<ActionResult<DashboardDto>> Dashboard(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int? modelVersionId) =>
        await _service.Dashboard(from, to, modelVersionId);

    [HttpGet("configs")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<List<SystemConfigDto>>> Configs() =>
        await _service.Configs();

    [HttpPut("configs/{key}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> UpdateConfig(string key, UpdateConfigRequest req) =>
        await _service.UpdateConfig(key, req);

    [HttpGet("configs/threshold-impact")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ThresholdImpactDto>> ThresholdImpact(
        [FromQuery] string key,
        [FromQuery] decimal proposed) =>
        await _service.ThresholdImpact(key, proposed);

    [HttpGet("models")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<List<ModelVersionDto>>> Models() =>
        await _service.Models();

    [HttpPost("models")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ModelVersionDto>> RegisterModel(RegisterModelRequest req) =>
        await _service.RegisterModel(req);

    [HttpPut("models/{id:int}/activate")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> ActivateModel(int id, ConcurrencyRequest req) =>
        await _service.ActivateModel(id, req);

    [HttpDelete("models/{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> DeleteModel(int id, [FromQuery] string rowVersion) =>
        await _service.DeleteModel(id, rowVersion);

    [HttpGet("audit")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<KeysetResult<AuditLogDto>>> Audit(
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] int? entityId,
        [FromQuery] int? userId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? cursor,
        [FromQuery] int size = 25) =>
        await _service.Audit(action, entityType, entityId, userId, from, to, cursor, size);
}
