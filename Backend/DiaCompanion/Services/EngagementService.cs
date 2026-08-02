using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-53..57 — thông báo, triệu chứng, phản hồi.</summary>
public class EngagementService : BaseService, IEngagementService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly ISymptomAdviceService _advice;
    private readonly INotificationService _notify;

    public EngagementService(IRepository repository, ICurrentUser me,
                                ISymptomAdviceService advice, INotificationService notify)
    { _repository = repository; _me = me; _advice = advice; _notify = notify; }

    /* -------------------------- THÔNG BÁO (UC-54) -------------------------- */
    public async Task<ActionResult<PagedResult<NotificationDto>>> Notifications([FromQuery] PageQuery page)
    {
        var uid = _me.RequireId();
        var query = _repository.Notifications.AsNoTracking().Where(n => n.UserId == uid);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(n => n.CreatedAt)
            .Skip(page.Skip).Take(page.PageSize)
            .Select(n => new NotificationDto
            {
                Id = n.Id,
                Type = (byte)n.Type,
                Title = n.Title,
                Message = n.Message,
                LinkEntity = n.LinkEntity,
                LinkEntityId = n.LinkEntityId,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }).ToListAsync();

        return Ok(new PagedResult<NotificationDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }
    public async Task<IActionResult> UnreadCount()
    {
        var uid = _me.RequireId();
        return Ok(new { count = await _repository.Notifications.CountAsync(n => n.UserId == uid && !n.IsRead) });
    }
    public async Task<IActionResult> MarkRead(long id)
    {
        var uid = _me.RequireId();
        var n = await _repository.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == uid)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy thông báo.");

        n.IsRead = true;
        n.ReadAt = DateTime.UtcNow;
        await _repository.SaveChangesAsync();
        return Ok(new { message = "Đã đánh dấu đã đọc." });
    }
    public async Task<IActionResult> MarkAllRead()
    {
        var uid = _me.RequireId();
        await _repository.Notifications.Where(n => n.UserId == uid && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true)
                                      .SetProperty(n => n.ReadAt, DateTime.UtcNow));
        return Ok(new { message = "Đã đánh dấu tất cả đã đọc." });
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
    public async Task<ActionResult<SymptomReportDto>> ReportSymptom(CreateSymptomRequest req)
    {
        var pid = RequireMyPatientId(_me);

        var report = new SymptomReport
        {
            PatientId = pid,
            Symptoms = req.Symptoms.Trim(),
            Severity = req.Severity,
            Description = req.Description,
            OnsetNote = req.OnsetNote,
            AutoAdvice = _advice.Generate(req.Severity)   // BR-20
        };

        _repository.SymptomReports.Add(report);

        // Báo cho bác sĩ của lượt khám gần nhất — định nghĩa "bác sĩ phụ trách"
        var doctorId = await _repository.Visits.Where(v => v.PatientId == pid && v.DoctorId != null)
            .OrderByDescending(v => v.VisitDate).Select(v => v.DoctorId).FirstOrDefaultAsync();

        if (doctorId is int did)
        {
            var patient = await _repository.Patients.FirstAsync(p => p.Id == pid);
            _notify.Push(did, NotificationType.Result,
                req.Severity == SymptomSeverity.Severe ? "Báo triệu chứng NẶNG" : "Bệnh nhân báo triệu chứng",
                $"{patient.FullName} ({patient.Code}): {report.Symptoms}",
                nameof(SymptomReport), report.Id);
        }

        await _repository.SaveChangesAsync();
        return Ok(Map(report, null));
    }
    public async Task<ActionResult<PagedResult<SymptomReportDto>>> Symptoms(
        [FromQuery] int? patientId, [FromQuery] bool pendingOnly = false, [FromQuery] PageQuery? page = null)
    {
        page ??= new PageQuery();
        var query = _repository.SymptomReports.AsNoTracking().Include(s => s.Patient).AsQueryable();

        if (_me.Role == UserRole.Patient)
        {
            // Phải lấy ra biến trước: EF không dịch được lời gọi phương thức
            // nằm bên trong biểu thức truy vấn.
            var myPid = RequireMyPatientId(_me);
            query = query.Where(s => s.PatientId == myPid);
        }
        else if (patientId is int pid)
        {
            query = query.Where(s => s.PatientId == pid);
        }

        if (pendingOnly) query = query.Where(s => s.DoctorReply == null);

        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(s => s.Severity).ThenByDescending(s => s.CreatedAt)
            .Skip(page.Skip).Take(page.PageSize).ToListAsync();

        var replierIds = rows.Where(r => r.RepliedBy != null).Select(r => r.RepliedBy!.Value).Distinct().ToList();
        var repliers = await _repository.Users.Where(u => replierIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);

        var items = rows.Select(r => Map(r, r.RepliedBy is int rb && repliers.ContainsKey(rb) ? repliers[rb] : null))
            .ToList();

        return Ok(new PagedResult<SymptomReportDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }

    /// <summary>Bác sĩ trả lời — ghi vào DoctorReply, KHÔNG đụng AutoAdvice.</summary>
    public async Task<IActionResult> Reply(int id, DoctorReplyRequest req)
    {
        var s = await _repository.SymptomReports.Include(x => x.Patient).FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy báo cáo triệu chứng.");

        _repository.ApplyOriginalRowVersion(s, req.RowVersion);

        s.DoctorReply = req.Reply.Trim();
        s.RepliedBy = _me.RequireId();
        s.RepliedAt = DateTime.UtcNow;

        if (s.Patient is not null)
            _notify.PushToPatient(s.Patient, NotificationType.Result,
                "Bác sĩ đã trả lời",
                "Bác sĩ đã phản hồi báo cáo triệu chứng của bạn.",
                nameof(SymptomReport), s.Id);

        await _repository.SaveChangesAsync();
        return Ok(new
        {
            message = "Đã gửi phản hồi tới bệnh nhân.",
            rowVersion = s.ToRowVersion()
        });
    }

    /* -------------------------- PHẢN HỒI (UC-56, 57) ----------------------- */
    public async Task<IActionResult> CreateFeedback(CreateFeedbackRequest req)
    {
        var pid = RequireMyPatientId(_me);
        _repository.Feedbacks.Add(new Feedback
        {
            PatientId = pid,
            VisitId = req.VisitId,
            Rating = req.Rating,
            Tags = req.Tags,
            Comment = req.Comment
        });
        await _repository.SaveChangesAsync();
        return Ok(new { message = "Cảm ơn bạn đã gửi phản hồi." });
    }

    /// <summary>UC-57 — quản trị viên xem phản hồi tổng hợp.</summary>
    public async Task<ActionResult<PagedResult<FeedbackDto>>> Feedbacks(
        [FromQuery] byte? rating, [FromQuery] PageQuery page)
    {
        var query = _repository.Feedbacks.AsNoTracking();
        if (rating is byte r) query = query.Where(f => f.Rating == r);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(f => f.CreatedAt)
            .Skip(page.Skip).Take(page.PageSize)
            .Select(f => new FeedbackDto
            {
                Id = f.Id,
                VisitId = f.VisitId,
                Rating = f.Rating,
                Tags = f.Tags,
                Comment = f.Comment,
                CreatedAt = f.CreatedAt
            }).ToListAsync();

        return Ok(new PagedResult<FeedbackDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }
    public async Task<IActionResult> FeedbackSummary()
    {
        var all = await _repository.Feedbacks.AsNoTracking().Select(f => f.Rating).ToListAsync();
        return Ok(new
        {
            total = all.Count,
            average = all.Count > 0 ? Math.Round(all.Average(r => (double)r), 2) : 0,
            distribution = Enumerable.Range(1, 5).ToDictionary(i => i.ToString(), i => all.Count(r => r == i))
        });
    }

    private static SymptomReportDto Map(SymptomReport s, string? replierName) => new()
    {
        Id = s.Id,
        Symptoms = s.Symptoms,
        Severity = (byte)s.Severity,
        Description = s.Description,
        OnsetNote = s.OnsetNote,
        AutoAdvice = s.AutoAdvice,
        DoctorReply = s.DoctorReply,
        RepliedByName = replierName,
        RepliedAt = s.RepliedAt,
        CreatedAt = s.CreatedAt,
        PatientName = s.Patient?.FullName ?? "",
        RowVersion = s.ToRowVersion(),
        // Ba trạng thái để giao diện hiển thị đúng, thay vì chỉ "có/không có trả lời"
        State = s.DoctorReply is not null ? "Bác sĩ đã trả lời" : "Chờ bác sĩ xem"
    };
}
