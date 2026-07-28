using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>NF-10 / NF-12: sinh lịch nhắc thuốc và tính tỉ lệ tuân thủ.</summary>
public interface IAdherenceService
{
    void GenerateSchedule(Prescription prescription, IEnumerable<PrescriptionItem> items);
    Task<AdherenceSummary> GetAsync(int patientId, int days = 30);
}

public record AdherenceSummary(int Total, int Taken, int Missed, int Pending, decimal Rate);

public class AdherenceService : IAdherenceService
{
    private readonly IRepository _repository;
    private readonly IClinicClock _clock;

    public AdherenceService(IRepository repository, IClinicClock clock) { _repository = repository; _clock = clock; }

    /// <summary>Giờ uống thuốc mặc định theo số lần/ngày (giờ địa phương).</summary>
    private static readonly Dictionary<byte, int[]> DoseHours = new()
    {
        [1] = new[] { 8 },
        [2] = new[] { 8, 20 },
        [3] = new[] { 8, 12, 20 },
        [4] = new[] { 7, 11, 15, 20 },
        [5] = new[] { 7, 10, 13, 17, 21 },
        [6] = new[] { 6, 9, 12, 15, 18, 21 },
    };

    public void GenerateSchedule(Prescription prescription, IEnumerable<PrescriptionItem> items)
    {
        var startLocal = _clock.LocalNow.Date;

        foreach (var item in items)
        {
            var hours = DoseHours.TryGetValue(item.TimesPerDay, out var h) ? h : new[] { 8 };

            for (var day = 0; day < item.DurationDays; day++)
            {
                var localDate = startLocal.AddDays(day);
                foreach (var hour in hours)
                {
                    var localDt = localDate.AddHours(hour);
                    _repository.MedicationLogs.Add(new MedicationLog
                    {
                        PatientId = prescription.PatientId,
                        PrescriptionItemId = item.Id,
                        ScheduledAt = _clock.ToUtc(localDt),
                        // QT-10: lưu ngày ĐỊA PHƯƠNG để gom "hôm nay" không lệch
                        ScheduledLocalDate = DateOnly.FromDateTime(localDate),
                        Status = MedicationStatus.Pending
                    });
                }
            }
        }
    }

    public async Task<AdherenceSummary> GetAsync(int patientId, int days = 30)
    {
        var fromLocal = _clock.LocalToday.AddDays(-days);

        var logs = await _repository.MedicationLogs
            .Where(m => m.PatientId == patientId && m.ScheduledLocalDate >= fromLocal)
            .Select(m => m.Status)
            .ToListAsync();

        var taken = logs.Count(s => s == MedicationStatus.Taken);
        var missed = logs.Count(s => s == MedicationStatus.Missed);
        var pending = logs.Count(s => s == MedicationStatus.Pending);

        // Mẫu số chỉ tính liều ĐÃ tới hạn. Nếu tính cả liều tương lai thì tỉ lệ
        // tuân thủ luôn thấp giả tạo ngay sau khi kê đơn 30 ngày.
        var due = taken + missed;
        var rate = due == 0 ? 0m : Math.Round(taken * 100m / due, 1);

        return new AdherenceSummary(logs.Count, taken, missed, pending, rate);
    }
}
