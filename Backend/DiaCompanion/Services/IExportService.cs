using System.Text;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

public interface IExportService
{
    Task<IActionResult> VisitReport(int visitId);
    Task<ActionResult<object>> DisagreementCases([FromQuery] int? modelVersionId);
    Task<IActionResult> DisagreementCsv([FromQuery] int? modelVersionId);
}
