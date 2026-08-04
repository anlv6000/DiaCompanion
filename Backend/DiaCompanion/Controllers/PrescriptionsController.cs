using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Services;
using DiaCompanion.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-36..45 — đơn thuốc và tuân thủ.</summary>
public class PrescriptionsController : BaseApiController
{
    private readonly IPrescriptionsService _service;
    public PrescriptionsController(IPrescriptionsService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<PagedResult<PrescriptionDto>>> List(
        [FromQuery] int? patientId,
        [FromQuery] string? q,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] bool? voided,
        [FromQuery] PageQuery page) =>
        await _service.List(patientId, q, from, to, voided, page);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PrescriptionDto>> Get(int id) => await _service.Get(id);

    [HttpPost]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<ActionResult<PrescriptionDto>> Create(CreatePrescriptionRequest req) =>
        await _service.Create(req);

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<ActionResult<PrescriptionDto>> Update(int id, UpdatePrescriptionRequest req) =>
        await _service.Update(id, req);

    [HttpPut("{id:int}/void")]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<IActionResult> Void(int id, VoidRequest req) => await _service.Void(id, req);

    [HttpGet("adherence/{patientId:int}")]
    public async Task<IActionResult> Adherence(
        int patientId,
        [FromQuery] int days = 30,
        [FromQuery] int? prescriptionId = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null) =>
        await _service.Adherence(patientId, days, prescriptionId, from, to);
}
