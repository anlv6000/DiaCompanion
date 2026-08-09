using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-49..52 — thông báo, triệu chứng và phản hồi.</summary>
[Route("api/engagement")]
public class EngagementController : BaseApiController
{
    private readonly IEngagementService _service;
    public EngagementController(IEngagementService service) => _service = service;

    [HttpGet("notifications")]
    public async Task<ActionResult<PagedResult<NotificationDto>>> Notifications([FromQuery] PageQuery page) =>
        await _service.Notifications(page);

    [HttpGet("notifications/unread-count")]
    public async Task<IActionResult> UnreadCount() => await _service.UnreadCount();

    [HttpPut("notifications/{id:long}/read")]
    public async Task<IActionResult> MarkRead(long id) => await _service.MarkRead(id);

    [HttpPut("notifications/read-all")]
    public async Task<IActionResult> MarkAllRead() => await _service.MarkAllRead();

    [HttpPost("symptoms")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<SymptomReportDto>> ReportSymptom(CreateSymptomRequest req) =>
        await _service.ReportSymptom(req);

    [HttpGet("symptoms")]
    [Authorize(Roles = Roles.DoctorOrPatient)]
    public async Task<ActionResult<PagedResult<SymptomReportDto>>> Symptoms(
        [FromQuery] int? patientId,
        [FromQuery] bool pendingOnly = false,
        [FromQuery] PageQuery? page = null) =>
        await _service.Symptoms(patientId, pendingOnly, page);

    [HttpPut("symptoms/{id:int}/reply")]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<IActionResult> Reply(int id, DoctorReplyRequest req) =>
        await _service.Reply(id, req);

    [HttpPost("feedback")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<IActionResult> CreateFeedback(CreateFeedbackRequest req) =>
        await _service.CreateFeedback(req);

    [HttpGet("feedback")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<PagedResult<FeedbackDto>>> Feedbacks(
        [FromQuery] byte? rating,
        [FromQuery] string? q,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] PageQuery page) =>
        await _service.Feedbacks(rating, q, from, to, page);

    [HttpGet("feedback/summary")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> FeedbackSummary() => await _service.FeedbackSummary();
}
