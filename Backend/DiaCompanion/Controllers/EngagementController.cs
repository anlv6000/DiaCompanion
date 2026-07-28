using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-53..57 — thông báo, triệu chứng, phản hồi.</summary>
[Route("api/engagement")]
public class EngagementController : BaseApiController
{
    private readonly IEngagementService _service;

    public EngagementController(IEngagementService service) => _service = service;


    /* -------------------------- THÔNG BÁO (UC-54) -------------------------- */

    [HttpGet("notifications")]
    public async Task<ActionResult<PagedResult<NotificationDto>>> Notifications([FromQuery] PageQuery page)
    {
        return await _service.Notifications(page);
    }


    [HttpGet("notifications/unread-count")]
    public async Task<IActionResult> UnreadCount()
    {
        return await _service.UnreadCount();
    }


    [HttpPut("notifications/{id:long}/read")]
    public async Task<IActionResult> MarkRead(long id)
    {
        return await _service.MarkRead(id);
    }


    [HttpPut("notifications/read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        return await _service.MarkAllRead();
    }


    /* ------------------------- TRIỆU CHỨNG (UC-55) ------------------------- */

    /// <summary>
    /// UC-55 — bệnh nhân báo triệu chứng.
    ///
    /// Hai nguồn khuyến cáo TÁCH BIỆT:
    ///   AutoAdvice  — hệ thống sinh NGAY theo mức độ, bất biến, là lưới an toàn
    ///                 để bệnh nhân nặng không ngồi chờ tin nhắn.
    ///   DoctorReply — bác sĩ trả lời sau, trong giờ làm việc.
    /// Nếu dùng chung một cột thì trả lời của bác sĩ sẽ ghi đè khuyến cáo tự động
    /// và mất vết nguồn gốc — không chấp nhận được với dữ liệu y tế.
    /// </summary>
    [HttpPost("symptoms")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<SymptomReportDto>> ReportSymptom(CreateSymptomRequest req)
    {
        return await _service.ReportSymptom(req);
    }


    [HttpGet("symptoms")]
    public async Task<ActionResult<PagedResult<SymptomReportDto>>> Symptoms(
    [FromQuery] int? patientId, [FromQuery] bool pendingOnly = false, [FromQuery] PageQuery? page = null)
    {
        return await _service.Symptoms(patientId, pendingOnly, page);
    }


    /// <summary>Bác sĩ trả lời — ghi vào DoctorReply, KHÔNG đụng AutoAdvice.</summary>
    [HttpPut("symptoms/{id:int}/reply")]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<IActionResult> Reply(int id, DoctorReplyRequest req)
    {
        return await _service.Reply(id, req);
    }


    /* -------------------------- PHẢN HỒI (UC-56, 57) ----------------------- */

    [HttpPost("feedback")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<IActionResult> CreateFeedback(CreateFeedbackRequest req)
    {
        return await _service.CreateFeedback(req);
    }


    /// <summary>UC-57 — quản trị viên xem phản hồi tổng hợp.</summary>
    [HttpGet("feedback")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<PagedResult<FeedbackDto>>> Feedbacks(
    [FromQuery] byte? rating, [FromQuery] PageQuery page)
    {
        return await _service.Feedbacks(rating, page);
    }


    [HttpGet("feedback/summary")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> FeedbackSummary()
    {
        return await _service.FeedbackSummary();
    }
}
