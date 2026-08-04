using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DiaCompanion.Api.Services;

/// <summary>UC-49..52 — thông báo, triệu chứng và phản hồi dịch vụ.</summary>
public class EngagementService : BaseService, IEngagementService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly ISymptomAdviceService _advice;
    private readonly INotificationService _notify;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public EngagementService(
        IRepository repository,
        ICurrentUser me,
        ISymptomAdviceService advice,
        INotificationService notify,
        IAuditService audit,
        IClinicClock clock)
    {
        _repository = repository;
        _me = me;
        _advice = advice;
        _notify = notify;
        _audit = audit;
        _clock = clock;
    }

    public async Task<ActionResult<PagedResult<NotificationDto>>> Notifications(PageQuery page)
    {
        var userId = _me.RequireId();
        var now = _clock.UtcNow;
        var query = _repository.Notifications.AsNoTracking()
            .Where(n => n.UserId == userId && (n.ExpiresAt == null || n.ExpiresAt > now));

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip(page.Skip)
            .Take(page.PageSize)
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
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = total
        });
    }

    public async Task<IActionResult> UnreadCount()
    {
        var userId = _me.RequireId();
        var now = _clock.UtcNow;
        var count = await _repository.Notifications.CountAsync(n =>
            n.UserId == userId && !n.IsRead && (n.ExpiresAt == null || n.ExpiresAt > now));
        return Ok(new { count });
    }

    public async Task<IActionResult> MarkRead(long id)
    {
        var userId = _me.RequireId();
        var notification = await _repository.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy thông báo.");

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = _clock.UtcNow;
            await _repository.SaveChangesAsync();
        }

        return Ok(new { message = "Đã đánh dấu đã đọc." });
    }

    public async Task<IActionResult> MarkAllRead()
    {
        var userId = _me.RequireId();
        var now = _clock.UtcNow;
        await _repository.Notifications
            .Where(n => n.UserId == userId && !n.IsRead && (n.ExpiresAt == null || n.ExpiresAt > now))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(n => n.IsRead, true)
                .SetProperty(n => n.ReadAt, now));
        return Ok(new { message = "Đã đánh dấu tất cả đã đọc." });
    }

    /// <summary>UC-50 — hệ thống sinh hướng dẫn ngay và chuyển đúng bác sĩ phụ trách.</summary>
    public async Task<ActionResult<SymptomReportDto>> ReportSymptom(CreateSymptomRequest req)
    {
        var patientId = RequireMyPatientId(_me);
        var responsibleDoctorId = await _repository.Visits.AsNoTracking()
            .Where(v => v.PatientId == patientId && v.DoctorId != null)
            .OrderByDescending(v => v.VisitDate)
            .ThenByDescending(v => v.Id)
            .Select(v => v.DoctorId)
            .FirstOrDefaultAsync();

        var report = new SymptomReport
        {
            PatientId = patientId,
            ResponsibleDoctorId = responsibleDoctorId,
            Symptoms = req.Symptoms.Trim(),
            Severity = req.Severity,
            Description = req.Description?.Trim(),
            OnsetNote = req.OnsetNote?.Trim(),
            AutoAdvice = _advice.Generate(req.Severity),
            CreatedAt = _clock.UtcNow
        };

        var strategy = _repository.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _repository.Database.BeginTransactionAsync();
            try
            {
                _repository.SymptomReports.Add(report);
                await _repository.SaveChangesAsync();

                if (responsibleDoctorId is int doctorId)
                {
                    var patient = await _repository.Patients.AsNoTracking()
                        .FirstAsync(p => p.Id == patientId);
                    _notify.Push(
                        doctorId,
                        NotificationType.Result,
                        req.Severity == SymptomSeverity.Severe
                            ? "Báo triệu chứng NẶNG"
                            : "Bệnh nhân báo triệu chứng",
                        $"{patient.FullName} ({patient.Code}): {report.Symptoms}",
                        nameof(SymptomReport),
                        report.Id);
                }

                await _audit.LogAsync(
                    AuditAction.SymptomReport,
                    nameof(SymptomReport),
                    report.Id,
                    null,
                    new
                    {
                        report.PatientId,
                        report.ResponsibleDoctorId,
                        severity = report.Severity.ToString()
                    });

                await _repository.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        });

        return Ok(await GetSymptomDtoAsync(report.Id));
    }

    public async Task<ActionResult<PagedResult<SymptomReportDto>>> Symptoms(
        int? patientId,
        bool pendingOnly = false,
        PageQuery? page = null)
    {
        page ??= new PageQuery();
        var query = _repository.SymptomReports.AsNoTracking()
            .Include(s => s.Patient)
            .Include(s => s.ResponsibleDoctor)
            .AsQueryable();

        if (_me.Role == UserRole.Patient)
        {
            var myPatientId = RequireMyPatientId(_me);
            query = query.Where(s => s.PatientId == myPatientId);
        }
        else if (_me.Role == UserRole.Doctor)
        {
            var doctorId = _me.RequireId();
            query = query.Where(s => s.ResponsibleDoctorId == doctorId);
            if (patientId is int requestedPatientId)
                query = query.Where(s => s.PatientId == requestedPatientId);
        }
        else
        {
            throw AppException.Forbidden(Msg.Forbidden, "Chỉ bệnh nhân và bác sĩ phụ trách được xem báo cáo triệu chứng.");
        }

        if (pendingOnly)
            query = query.Where(s => s.DoctorReply == null);

        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(s => s.Severity)
            .ThenByDescending(s => s.CreatedAt)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .ToListAsync();

        var replierIds = rows
            .Where(r => r.RepliedBy != null)
            .Select(r => r.RepliedBy!.Value)
            .Distinct()
            .ToList();
        var repliers = await _repository.Users.AsNoTracking()
            .Where(u => replierIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);

        var items = rows.Select(r => MapSymptom(
            r,
            r.RepliedBy is int replierId && repliers.TryGetValue(replierId, out var name)
                ? name
                : null)).ToList();

        return Ok(new PagedResult<SymptomReportDto>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = total
        });
    }

    public async Task<IActionResult> Reply(int id, DoctorReplyRequest req)
    {
        var doctorId = _me.RequireId();
        var report = await _repository.SymptomReports
            .Include(s => s.Patient)
            .FirstOrDefaultAsync(s => s.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy báo cáo triệu chứng.");

        if (report.ResponsibleDoctorId != doctorId)
            throw AppException.Forbidden(
                Msg.Forbidden,
                "Chỉ bác sĩ phụ trách tại thời điểm báo cáo được phản hồi triệu chứng này.");

        _repository.ApplyOriginalRowVersion(report, req.RowVersion);
        var oldReply = report.DoctorReply;
        report.DoctorReply = req.Reply.Trim();
        report.RepliedBy = doctorId;
        report.RepliedAt = _clock.UtcNow;

        if (report.Patient is not null)
        {
            _notify.PushToPatient(
                report.Patient,
                NotificationType.Result,
                "Bác sĩ đã trả lời",
                "Bác sĩ phụ trách đã phản hồi báo cáo triệu chứng của bạn.",
                nameof(SymptomReport),
                report.Id);
        }

        await _audit.LogAsync(
            AuditAction.SymptomReply,
            nameof(SymptomReport),
            report.Id,
            new { doctorReply = oldReply },
            new { report.DoctorReply, report.RepliedBy });
        await _repository.SaveChangesAsync();

        return Ok(new
        {
            message = "Đã gửi phản hồi tới bệnh nhân.",
            rowVersion = report.ToRowVersion()
        });
    }

    /// <summary>UC-51 — chỉ cho phản hồi lượt khám đã hoàn tất của chính bệnh nhân.</summary>
    public async Task<IActionResult> CreateFeedback(CreateFeedbackRequest req)
    {
        var patientId = RequireMyPatientId(_me);

        if (req.VisitId is int visitId)
        {
            var visit = await _repository.Visits.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == visitId)
                ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");

            if (visit.PatientId != patientId)
                throw AppException.Forbidden(Msg.Forbidden, "Bạn không có quyền phản hồi lượt khám này.");
            if (visit.Status != VisitStatus.Completed)
                throw AppException.BadRequest(Msg.ApptImmutable, "Chỉ có thể phản hồi sau khi lượt khám đã hoàn tất.");
            if (await _repository.Feedbacks.AnyAsync(f => f.PatientId == patientId && f.VisitId == visitId))
                throw AppException.Conflict(Msg.ConcurrentEdit, "Bạn đã gửi phản hồi cho lượt khám này.");
        }

        var feedback = new Feedback
        {
            PatientId = patientId,
            VisitId = req.VisitId,
            Rating = req.Rating,
            Tags = req.Tags?.Trim(),
            Comment = req.Comment?.Trim(),
            CreatedAt = _clock.UtcNow
        };
        var strategy = _repository.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _repository.Database.BeginTransactionAsync();
            try
            {
                _repository.Feedbacks.Add(feedback);
                await _repository.SaveChangesAsync();

                await _audit.LogAsync(
                    AuditAction.FeedbackCreate,
                    nameof(Feedback),
                    feedback.Id,
                    null,
                    new { feedback.PatientId, feedback.VisitId, feedback.Rating });
                await _repository.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        });

        return Ok(new { message = "Cảm ơn bạn đã gửi phản hồi.", feedbackId = feedback.Id });
    }

    public async Task<ActionResult<PagedResult<FeedbackDto>>> Feedbacks(
        byte? rating,
        string? q,
        DateOnly? from,
        DateOnly? to,
        PageQuery page)
    {
        var query = _repository.Feedbacks.AsNoTracking()
            .Include(f => f.Patient)
            .AsQueryable();

        if (rating is byte value)
            query = query.Where(f => f.Rating == value);
        if (from is DateOnly fromDate)
        {
            var fromUtc = _clock.ToUtc(fromDate.ToDateTime(TimeOnly.MinValue));
            query = query.Where(f => f.CreatedAt >= fromUtc);
        }
        if (to is DateOnly toDate)
        {
            var toExclusiveUtc = _clock.ToUtc(toDate.AddDays(1).ToDateTime(TimeOnly.MinValue));
            query = query.Where(f => f.CreatedAt < toExclusiveUtc);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var keyword = q.Trim();
            var normalized = VietnameseText.RemoveDiacritics(keyword);
            query = query.Where(f =>
                EF.Functions.Like(f.Patient!.Code, $"%{keyword}%") ||
                EF.Functions.Like(f.Patient.FullNameSearch!, $"%{normalized}%") ||
                (f.Comment != null && EF.Functions.Like(f.Comment, $"%{keyword}%")));
        }

        var total = await query.CountAsync();
        query = page.Sort?.Trim().ToLowerInvariant() switch
        {
            "rating" => page.Desc
                ? query.OrderByDescending(f => f.Rating).ThenByDescending(f => f.CreatedAt)
                : query.OrderBy(f => f.Rating).ThenByDescending(f => f.CreatedAt),
            "patient" => page.Desc
                ? query.OrderByDescending(f => f.Patient!.FullName).ThenByDescending(f => f.CreatedAt)
                : query.OrderBy(f => f.Patient!.FullName).ThenByDescending(f => f.CreatedAt),
            _ => page.Desc
                ? query.OrderBy(f => f.CreatedAt)
                : query.OrderByDescending(f => f.CreatedAt)
        };

        var items = await query
            .Skip(page.Skip)
            .Take(page.PageSize)
            .Select(f => new FeedbackDto
            {
                Id = f.Id,
                PatientId = f.PatientId,
                PatientCode = f.Patient!.Code,
                PatientName = f.Patient.FullName,
                VisitId = f.VisitId,
                Rating = f.Rating,
                Tags = f.Tags,
                Comment = f.Comment,
                CreatedAt = f.CreatedAt
            }).ToListAsync();

        return Ok(new PagedResult<FeedbackDto>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = total
        });
    }

    public async Task<IActionResult> FeedbackSummary()
    {
        var ratings = await _repository.Feedbacks.AsNoTracking()
            .Select(f => f.Rating)
            .ToListAsync();
        return Ok(new
        {
            total = ratings.Count,
            average = ratings.Count > 0 ? Math.Round(ratings.Average(r => (double)r), 2) : 0,
            distribution = Enumerable.Range(1, 5)
                .ToDictionary(i => i.ToString(), i => ratings.Count(r => r == i))
        });
    }

    private async Task<SymptomReportDto> GetSymptomDtoAsync(int id)
    {
        var report = await _repository.SymptomReports.AsNoTracking()
            .Include(s => s.Patient)
            .Include(s => s.ResponsibleDoctor)
            .FirstAsync(s => s.Id == id);
        return MapSymptom(report, null);
    }

    private static SymptomReportDto MapSymptom(SymptomReport report, string? replierName) => new()
    {
        Id = report.Id,
        Symptoms = report.Symptoms,
        Severity = (byte)report.Severity,
        Description = report.Description,
        OnsetNote = report.OnsetNote,
        AutoAdvice = report.AutoAdvice,
        DoctorReply = report.DoctorReply,
        RepliedByName = replierName,
        RepliedAt = report.RepliedAt,
        CreatedAt = report.CreatedAt,
        PatientName = report.Patient?.FullName ?? "",
        ResponsibleDoctorId = report.ResponsibleDoctorId,
        ResponsibleDoctorName = report.ResponsibleDoctor?.FullName,
        RowVersion = report.ToRowVersion(),
        State = report.DoctorReply is not null
            ? "Bác sĩ đã trả lời"
            : report.ResponsibleDoctorId is null
                ? "Chưa xác định bác sĩ phụ trách"
                : "Chờ bác sĩ xem"
    };
}
