using DiaCompanion.Api.Common;
using DiaCompanion.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-34, UC-35 — báo cáo khám và dữ liệu bất đồng người–AI.</summary>
[Route("api/export")]
public class ExportController : BaseApiController
{
    private readonly IExportService _service;
    public ExportController(IExportService service) => _service = service;

    [HttpGet("visit-report/{visitId:int}")]
    public async Task<IActionResult> VisitReport(int visitId) =>
        await _service.VisitReport(visitId);

    [HttpGet("visit-report/{visitId:int}.pdf")]
    public async Task<IActionResult> VisitReportPdf(int visitId) =>
        await _service.VisitReportPdf(visitId);

    [HttpGet("disagreement-cases")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<object>> DisagreementCases(
        [FromQuery] int? modelVersionId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to) =>
        await _service.DisagreementCases(modelVersionId, from, to);

    [HttpGet("disagreement-cases.csv")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> DisagreementCsv(
        [FromQuery] int? modelVersionId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to) =>
        await _service.DisagreementCsv(modelVersionId, from, to);
}
