using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Dtos;
using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Api.Services;

public interface IPrescriptionsService
{
    Task<ActionResult<PagedResult<PrescriptionDto>>> List(
        [FromQuery] int? patientId, [FromQuery] PageQuery page);
    Task<ActionResult<PrescriptionDto>> Get(int id);
    Task<ActionResult<PrescriptionDto>> Create(CreatePrescriptionRequest req);
    Task<ActionResult<PrescriptionDto>> Update(int id, UpdatePrescriptionRequest req);
    Task<IActionResult> Void(int id, VoidRequest req);
    Task<IActionResult> Adherence(int patientId, [FromQuery] int days = 30);
}
