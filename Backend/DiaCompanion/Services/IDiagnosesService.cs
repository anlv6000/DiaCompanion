using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

public interface IDiagnosesService
{
    Task<ActionResult<AiDiagnosisDto>> Run(int imageId, CancellationToken ct);
    Task<ActionResult<AiDiagnosisDto>> Get(int id);
    Task<ActionResult<List<AiDiagnosisDto>>> ByImage(int imageId);
    Task<IActionResult> Void(int id, VoidRequest req);
    Task<ActionResult<ProgressionDto>> Progression(int patientId, [FromQuery] int months = 24);
}
