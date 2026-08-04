using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Api.Services;

public interface IExportService
{
    Task<IActionResult> VisitReport(int visitId);
    Task<IActionResult> VisitReportPdf(int visitId);
    Task<ActionResult<object>> DisagreementCases(int? modelVersionId, DateOnly? from, DateOnly? to);
    Task<IActionResult> DisagreementCsv(int? modelVersionId, DateOnly? from, DateOnly? to);
}
