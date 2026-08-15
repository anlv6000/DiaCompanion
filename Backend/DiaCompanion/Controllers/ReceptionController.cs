using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>LT-1..LT-9 — nghiệp vụ của Lễ tân.</summary>
[Route("api/reception")]
public class ReceptionController : BaseApiController
{
    private readonly IReceptionService _service;
    public ReceptionController(IReceptionService service) => _service = service;

    [HttpGet("on-duty")]
    [Authorize(Roles = Roles.Receptionist)]
    public Task<ActionResult<OnDutyResponse>> OnDuty([FromQuery] DateOnly? date, [FromQuery] byte? shift, string? q) =>
        _service.OnDuty(date, shift, q);

    [HttpGet("shifts")]
    [Authorize(Roles = Roles.Admin)]
    public Task<ActionResult<List<DoctorShiftDto>>> ListShifts([FromQuery] int? doctorId) =>
        _service.ListShifts(doctorId);

    [HttpPost("shifts")]
    [Authorize(Roles = Roles.Admin)]
    public Task<ActionResult<DoctorShiftDto>> CreateShift(CreateDoctorShiftRequest req) =>
        _service.CreateShift(req);

    [HttpPost("shifts/batch")]
    [Authorize(Roles = Roles.Admin)]
    public Task<ActionResult<List<DoctorShiftDto>>> CreateShiftsBatch(CreateDoctorShiftsBatchRequest req) =>
        _service.CreateShiftsBatch(req);

    [HttpPut("shifts/{id:int}/active")]
    [Authorize(Roles = Roles.Admin)]
    public Task<ActionResult<DoctorShiftDto>> SetShiftActive(
        int id, [FromQuery] bool active, [FromQuery] string rowVersion) =>
        _service.SetShiftActive(id, active, rowVersion);

    [HttpDelete("shifts/{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public Task<IActionResult> DeleteShift(int id, [FromQuery] string rowVersion) =>
        _service.DeleteShift(id, rowVersion);
}
