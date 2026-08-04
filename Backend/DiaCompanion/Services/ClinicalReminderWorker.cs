using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using Microsoft.EntityFrameworkCore;

namespace DiaCompanion.Api.Services;

/// <summary>
/// UC-44 và UC-48. Tạo thông báo trong ứng dụng theo lịch dùng thuốc và ngày
/// tái tầm soát. Worker không gửi FCM/APNs; ứng dụng đọc các bản ghi Notification.
/// </summary>
public sealed class ClinicalReminderWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ClinicalReminderWorker> _logger;

    public ClinicalReminderWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<ClinicalReminderWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không thể tạo nhắc thuốc hoặc nhắc tái tầm soát.");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    internal async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository>();
        var notify = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var clock = scope.ServiceProvider.GetRequiredService<IClinicClock>();

        await ProcessMedicationRemindersAsync(repository, notify, clock, ct);
        await ProcessRecheckRemindersAsync(repository, notify, clock, ct);
    }

    private static async Task ProcessMedicationRemindersAsync(
        IRepository repository,
        INotificationService notify,
        IClinicClock clock,
        CancellationToken ct)
    {
        var now = clock.UtcNow;
        var missedBefore = now.AddHours(-2);

        // Liều quá hạn được chốt thành Missed trước, tránh gửi nhắc muộn vô nghĩa.
        await repository.MedicationLogs
            .Where(x => x.Status == MedicationStatus.Pending && x.ScheduledAt < missedBefore)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, MedicationStatus.Missed), ct);

        var remindUntil = now.AddMinutes(15);
        var logs = await repository.MedicationLogs
            .Include(x => x.PrescriptionItem)
                .ThenInclude(x => x!.Prescription)
                    .ThenInclude(x => x!.Patient)
            .Where(x => x.Status == MedicationStatus.Pending
                        && x.ReminderSentAt == null
                        && x.ScheduledAt >= missedBefore
                        && x.ScheduledAt <= remindUntil
                        && x.PrescriptionItem != null
                        && x.PrescriptionItem.IsActive
                        && x.PrescriptionItem.Prescription != null
                        && !x.PrescriptionItem.Prescription.IsVoided)
            .OrderBy(x => x.ScheduledAt)
            .Take(500)
            .ToListAsync(ct);

        foreach (var log in logs)
        {
            var item = log.PrescriptionItem!;
            var prescription = item.Prescription!;
            var patient = prescription.Patient;
            if (patient?.UserId is not int userId)
                continue;

            var localTime = clock.ToLocal(log.ScheduledAt) ?? log.ScheduledAt;
            notify.Push(
                userId,
                NotificationType.Medication,
                "Đến giờ dùng thuốc",
                $"{item.DrugName} – {item.Dose}, lúc {localTime:HH:mm}. Vui lòng xác nhận sau khi dùng.",
                nameof(MedicationLog),
                log.Id);

            log.ReminderSentAt = now;
        }

        if (logs.Count > 0)
            await repository.SaveChangesAsync(ct);
    }

    private static async Task ProcessRecheckRemindersAsync(
        IRepository repository,
        INotificationService notify,
        IClinicClock clock,
        CancellationToken ct)
    {
        var today = clock.LocalToday;
        var rows = await repository.Visits.AsNoTracking()
            .Where(v => v.Status == VisitStatus.Completed
                        && v.ClosedAt != null
                        && v.RecheckMonths != null
                        && v.Patient != null
                        && v.Patient.UserId != null)
            .Select(v => new
            {
                v.Id,
                v.PatientId,
                UserId = v.Patient!.UserId!.Value,
                PatientName = v.Patient.FullName,
                ClosedAt = v.ClosedAt!.Value,
                RecheckMonths = v.RecheckMonths!.Value
            })
            .ToListAsync(ct);

        if (rows.Count == 0)
            return;

        var latestVisits = rows
            .GroupBy(x => x.PatientId)
            .Select(g => g.OrderByDescending(x => x.ClosedAt).ThenByDescending(x => x.Id).First())
            .ToList();

        var patientIds = latestVisits.Select(x => x.PatientId).ToList();
        var latestVisitDateByPatient = await repository.Visits.AsNoTracking()
            .Where(v => patientIds.Contains(v.PatientId))
            .GroupBy(v => v.PatientId)
            .Select(g => new { PatientId = g.Key, LatestVisitDate = g.Max(v => v.VisitDate) })
            .ToDictionaryAsync(x => x.PatientId, x => x.LatestVisitDate, ct);

        foreach (var visit in latestVisits)
        {
            // Có lượt khám mới sau lần đóng này nghĩa là bệnh nhân đã quay lại.
            if (latestVisitDateByPatient.TryGetValue(visit.PatientId, out var latestVisitDate)
                && latestVisitDate > visit.ClosedAt)
                continue;

            var closedLocal = clock.ToLocal(visit.ClosedAt) ?? visit.ClosedAt;
            var dueDate = DateOnly.FromDateTime(closedLocal.AddMonths(visit.RecheckMonths));
            var daysUntilDue = dueDate.DayNumber - today.DayNumber;
            var daysPastDue = -daysUntilDue;

            var shouldSend = daysUntilDue is 30 or 7 or 1 or 0
                             || (daysPastDue > 0 && daysPastDue % 7 == 0);
            if (!shouldSend)
                continue;

            var title = daysUntilDue >= 0
                ? $"Nhắc tái tầm soát {dueDate:dd/MM/yyyy}"
                : $"Tái tầm soát quá hạn {daysPastDue} ngày";

            var alreadySent = await repository.Notifications.AsNoTracking()
                .AnyAsync(n => n.UserId == visit.UserId
                               && n.Type == NotificationType.Recheck
                               && n.Title == title
                               && n.LinkEntity == nameof(Visit)
                               && n.LinkEntityId == visit.Id, ct);
            if (alreadySent)
                continue;

            var message = daysUntilDue switch
            {
                > 1 => $"Ngày tái tầm soát dự kiến của bạn là {dueDate:dd/MM/yyyy} (còn {daysUntilDue} ngày).",
                1 => $"Ngày mai ({dueDate:dd/MM/yyyy}) là ngày tái tầm soát dự kiến của bạn.",
                0 => $"Hôm nay ({dueDate:dd/MM/yyyy}) là ngày tái tầm soát dự kiến của bạn.",
                _ => $"Bạn đã quá ngày tái tầm soát dự kiến {daysPastDue} ngày. Vui lòng liên hệ cơ sở y tế."
            };

            notify.Push(
                visit.UserId,
                NotificationType.Recheck,
                title,
                message,
                nameof(Visit),
                visit.Id);
        }

        await repository.SaveChangesAsync(ct);
    }
}
