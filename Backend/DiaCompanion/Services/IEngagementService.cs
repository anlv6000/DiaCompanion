using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

public interface IEngagementService
{
    Task<ActionResult<PagedResult<NotificationDto>>> Notifications([FromQuery] PageQuery page);
    Task<IActionResult> UnreadCount();
    Task<IActionResult> MarkRead(long id);
    Task<IActionResult> MarkAllRead();
    Task<ActionResult<SymptomReportDto>> ReportSymptom(CreateSymptomRequest req);
    Task<ActionResult<PagedResult<SymptomReportDto>>> Symptoms(
        [FromQuery] int? patientId, [FromQuery] bool pendingOnly = false, [FromQuery] PageQuery? page = null);
    Task<IActionResult> Reply(int id, DoctorReplyRequest req);
    Task<IActionResult> CreateFeedback(CreateFeedbackRequest req);
    Task<ActionResult<PagedResult<FeedbackDto>>> Feedbacks(
        [FromQuery] byte? rating, [FromQuery] PageQuery page);
    Task<IActionResult> FeedbackSummary();
}
