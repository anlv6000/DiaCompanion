using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;

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

        // Mọi truy vấn/cập nhật EF nằm trong Repository; worker chỉ điều phối nghiệp vụ.
        await repository.MarkOverdueMedicationLogsMissedAsync(missedBefore, ct);

        var remindUntil = now.AddMinutes(15);
        var logs = await repository.GetMedicationReminderCandidatesAsync(
            missedBefore, remindUntil, 500, ct);

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
            await repository.CommitAsync(ct);
    }

    private static async Task ProcessRecheckRemindersAsync(
        IRepository repository,
        INotificationService notify,
        IClinicClock clock,
        CancellationToken ct)
    {
        var today = clock.LocalToday;
        var latestVisits = await repository.GetRecheckReminderCandidatesAsync(ct);
        if (latestVisits.Count == 0)
            return;

        foreach (var visit in latestVisits)
        {
            // Có lượt khám mới sau lần đóng này nghĩa là bệnh nhân đã quay lại.
            if (visit.LatestVisitDate is DateTime latestVisitDate && latestVisitDate > visit.ClosedAt)
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

            var alreadySent = await repository.NotificationExistsAsync(
                visit.UserId, NotificationType.Recheck, title, nameof(Visit), visit.VisitId, ct);
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
                visit.VisitId);
        }

        await repository.CommitAsync(ct);
    }
}
