using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>
/// UC-46..52 — theo dõi yếu tố nguy cơ của bệnh gốc.
/// Đây là dữ liệu bệnh nhân tự nhập nên dùng SOFT DELETE, không phải void.
/// </summary>
public class MonitoringService : BaseService, IMonitoringService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IClinicClock _clock;
    private readonly IConfigService _cfg;

    public MonitoringService(IRepository repository, ICurrentUser me, IClinicClock clock, IConfigService cfg)
    { _repository = repository; _me = me; _clock = clock; _cfg = cfg; }

    /* ------------------------------ CHỈ SỐ ------------------------------ */

    /// <summary>UC-48 — danh sách chỉ số, keyset pagination vì bảng này lớn nhất.</summary>
    public async Task<ActionResult<KeysetResult<HealthMetricDto>>> Metrics(
        [FromQuery] int? patientId, [FromQuery] MetricType? type,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] string? cursor, [FromQuery] int size = 50)
    {
        var pid = ResolvePatientId(patientId);
        size = size is < 1 or > 200 ? 50 : size;

        var query = _repository.HealthMetrics.AsNoTracking().Where(m => m.PatientId == pid);
        if (type is MetricType t) query = query.Where(m => m.MetricType == t);
        if (from is DateOnly f) query = query.Where(m => m.RecordedLocalDate >= f);
        if (to is DateOnly to2) query = query.Where(m => m.RecordedLocalDate <= to2);

        var decoded = Cursor.Decode(cursor);
        if (decoded is (DateTime at, long lastId))
            query = query.Where(m => m.RecordedAtUtc < at || (m.RecordedAtUtc == at && m.Id < lastId));

        var rows = await query
            .OrderByDescending(m => m.RecordedAtUtc).ThenByDescending(m => m.Id)
            .Take(size + 1).ToListAsync();

        var hasMore = rows.Count > size;
        if (hasMore) rows.RemoveAt(rows.Count - 1);

        var items = rows.Select(m => new HealthMetricDto
        {
            Id = m.Id,
            MetricType = (byte)m.MetricType,
            Value = m.Value,
            Unit = m.Unit,
            Context = (byte?)m.Context,
            RecordedAtUtc = m.RecordedAtUtc,
            RecordedLocalDate = m.RecordedLocalDate,
            Note = m.Note,
            IsAbnormal = m.IsAbnormal
        }).ToList();

        var last = rows.LastOrDefault();
        return Ok(new KeysetResult<HealthMetricDto>
        {
            Items = items,
            NextCursor = hasMore && last is not null ? Cursor.Encode(last.RecordedAtUtc, last.Id) : null
        });
    }

    /// <summary>UC-46 — ghi chỉ số.</summary>
    public async Task<ActionResult<HealthMetricDto>> CreateMetric(CreateMetricRequest req)
    {
        var pid = ResolvePatientId(null);
        var recordedUtc = req.RecordedAtUtc ?? DateTime.UtcNow;

        if (recordedUtc > DateTime.UtcNow.AddMinutes(5))
            throw AppException.BadRequest(Msg.RequiredFields, "Không thể ghi chỉ số ở thời điểm tương lai.");

        var (unit, min, max) = req.MetricType switch
        {
            MetricType.Glucose => ("mmol/L", 1m, 40m),
            MetricType.HbA1c => ("%", 3m, 20m),
            MetricType.SystolicBp => ("mmHg", 60m, 260m),
            MetricType.DiastolicBp => ("mmHg", 30m, 160m),
            _ => ("", 0m, 1000m)
        };

        if (req.Value < min || req.Value > max)
            throw AppException.BadRequest(Msg.RequiredFields,
                $"Giá trị phải nằm trong khoảng {min}–{max} {unit}.");

        var metric = new HealthMetric
        {
            PatientId = pid,
            MetricType = req.MetricType,
            Value = req.Value,
            Unit = unit,
            Context = req.Context,
            RecordedAtUtc = recordedUtc,
            // QT-10: ngày ĐỊA PHƯƠNG. Chỉ số đo 06:45 giờ VN là 23:45 UTC hôm trước;
            // gom theo ngày UTC sẽ đẩy nó sang sai ngày trên biểu đồ.
            RecordedLocalDate = _clock.ToLocalDate(recordedUtc),
            Note = req.Note,
            IsAbnormal = await IsAbnormalAsync(req.MetricType, req.Value, req.Context)
        };

        _repository.HealthMetrics.Add(metric);
        await _repository.SaveChangesAsync();

        return Ok(new HealthMetricDto
        {
            Id = metric.Id,
            MetricType = (byte)metric.MetricType,
            Value = metric.Value,
            Unit = metric.Unit,
            Context = (byte?)metric.Context,
            RecordedAtUtc = metric.RecordedAtUtc,
            RecordedLocalDate = metric.RecordedLocalDate,
            Note = metric.Note,
            IsAbnormal = metric.IsAbnormal
        });
    }

    /// <summary>UC-47 — sửa chỉ số đã nhập.</summary>
    public async Task<IActionResult> UpdateMetric(int id, CreateMetricRequest req)
    {
        var m = await _repository.HealthMetrics.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bản ghi.");
        EnsureCanAccessPatient(_me, m.PatientId);

        m.Value = req.Value;
        m.Context = req.Context;
        m.Note = req.Note;
        m.IsAbnormal = await IsAbnormalAsync(m.MetricType, req.Value, req.Context);

        await _repository.SaveChangesAsync();
        return Ok(new { message = "Đã lưu thay đổi." });
    }

    /// <summary>
    /// UC-47 — xoá chỉ số. XOÁ MỀM: bản ghi ẩn khỏi biểu đồ nhưng vẫn nằm trong
    /// CSDL để bác sĩ đối chiếu nếu cần (QT-5).
    /// </summary>
    public async Task<IActionResult> DeleteMetric(int id)
    {
        var m = await _repository.HealthMetrics.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bản ghi.");
        EnsureCanAccessPatient(_me, m.PatientId);

        m.IsDeleted = true;
        m.DeletedAt = DateTime.UtcNow;
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Đã ẩn bản ghi. Dữ liệu vẫn được lưu cho bác sĩ đối chiếu." });
    }

    /// <summary>UC-48 — tóm tắt để vẽ biểu đồ xu hướng.</summary>
    public async Task<IActionResult> Summary(int patientId, [FromQuery] int days = 30)
    {
        EnsureCanAccessPatient(_me, patientId);
        var from = _clock.LocalToday.AddDays(-days);

        var metrics = await _repository.HealthMetrics.AsNoTracking()
            .Where(m => m.PatientId == patientId && m.RecordedLocalDate >= from)
            .ToListAsync();

        var glucose = metrics.Where(m => m.MetricType == MetricType.Glucose).ToList();

        return Ok(new
        {
            days,
            glucoseAvg = glucose.Count > 0 ? Math.Round(glucose.Average(m => m.Value), 1) : (decimal?)null,
            glucoseAbnormalCount = glucose.Count(m => m.IsAbnormal),
            latestHbA1c = metrics.Where(m => m.MetricType == MetricType.HbA1c)
                .OrderByDescending(m => m.RecordedAtUtc).Select(m => (decimal?)m.Value).FirstOrDefault(),
            latestSystolic = metrics.Where(m => m.MetricType == MetricType.SystolicBp)
                .OrderByDescending(m => m.RecordedAtUtc).Select(m => (decimal?)m.Value).FirstOrDefault(),
            latestDiastolic = metrics.Where(m => m.MetricType == MetricType.DiastolicBp)
                .OrderByDescending(m => m.RecordedAtUtc).Select(m => (decimal?)m.Value).FirstOrDefault(),
            // Gom theo ngày ĐỊA PHƯƠNG để trục hoành biểu đồ đúng ngày bệnh nhân đo
            byDay = glucose.GroupBy(m => m.RecordedLocalDate)
                .OrderBy(g => g.Key)
                .Select(g => new { date = g.Key, avg = Math.Round(g.Average(x => x.Value), 1), count = g.Count() })
        });
    }

    /* ---------------------------- LỐI SỐNG ---------------------------- */

    /// <summary>UC-51 — nhật ký ăn uống và vận động.</summary>
    public async Task<ActionResult<List<LifestyleLogDto>>> Lifestyle(
        [FromQuery] int? patientId, [FromQuery] int days = 14)
    {
        var pid = ResolvePatientId(patientId);
        var from = _clock.LocalToday.AddDays(-days);

        var items = await _repository.LifestyleLogs.AsNoTracking()
            .Where(l => l.PatientId == pid && l.LogLocalDate >= from)
            .OrderByDescending(l => l.LogLocalDate)
            .Select(l => new LifestyleLogDto
            {
                Id = l.Id,
                LogLocalDate = l.LogLocalDate,
                MealNote = l.MealNote,
                MealTags = l.MealTags,
                ExerciseMinutes = l.ExerciseMinutes,
                ExerciseType = l.ExerciseType
            }).ToListAsync();

        return Ok(items);
    }
    public async Task<ActionResult<LifestyleLogDto>> CreateLifestyle(CreateLifestyleRequest req)
    {
        var pid = RequireMyPatientId(_me);
        var date = req.LogLocalDate ?? _clock.LocalToday;

        // Mỗi ngày một bản ghi: ghi lại cùng ngày thì cập nhật thay vì tạo trùng
        var log = await _repository.LifestyleLogs.FirstOrDefaultAsync(l => l.PatientId == pid && l.LogLocalDate == date);
        if (log is null)
        {
            log = new LifestyleLog { PatientId = pid, LogLocalDate = date };
            _repository.LifestyleLogs.Add(log);
        }

        log.MealNote = req.MealNote;
        log.MealTags = req.MealTags;
        log.ExerciseMinutes = req.ExerciseMinutes;
        log.ExerciseType = req.ExerciseType;

        await _repository.SaveChangesAsync();

        return Ok(new LifestyleLogDto
        {
            Id = log.Id,
            LogLocalDate = log.LogLocalDate,
            MealNote = log.MealNote,
            MealTags = log.MealTags,
            ExerciseMinutes = log.ExerciseMinutes,
            ExerciseType = log.ExerciseType
        });
    }

    /// <summary>UC-52 — xoá mềm nhật ký lối sống.</summary>
    public async Task<IActionResult> DeleteLifestyle(int id)
    {
        var l = await _repository.LifestyleLogs.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bản ghi.");
        EnsureCanAccessPatient(_me, l.PatientId);

        l.IsDeleted = true;
        l.DeletedAt = DateTime.UtcNow;
        await _repository.SaveChangesAsync();
        return Ok(new { message = "Đã ẩn bản ghi." });
    }

    /* ---------------------------- THUỐC ---------------------------- */

    /// <summary>UC-49 — lịch uống thuốc hôm nay.</summary>
    public async Task<ActionResult<List<MedicationLogDto>>> Today([FromQuery] int? patientId)
    {
        var pid = ResolvePatientId(patientId);
        var today = _clock.LocalToday;

        var items = await _repository.MedicationLogs.AsNoTracking()
            .Where(m => m.PatientId == pid && m.ScheduledLocalDate == today
                        && m.Status != MedicationStatus.Cancelled)
            .OrderBy(m => m.ScheduledAt)
            .Select(m => new MedicationLogDto
            {
                Id = m.Id,
                DrugName = m.PrescriptionItem!.DrugName,
                Dose = m.PrescriptionItem.Dose,
                ScheduledAt = m.ScheduledAt,
                TakenAt = m.TakenAt,
                Status = (byte)m.Status
            }).ToListAsync();

        return Ok(items);
    }

    /// <summary>UC-49 — xác nhận đã uống thuốc.</summary>
    public async Task<IActionResult> ConfirmTaken(int id, [FromQuery] bool taken = true)
    {
        var log = await _repository.MedicationLogs.FirstOrDefaultAsync(m => m.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lịch uống thuốc.");
        EnsureCanAccessPatient(_me, log.PatientId);

        if (log.Status == MedicationStatus.Cancelled)
            throw AppException.BadRequest(Msg.ApptImmutable, "Liều thuốc này đã bị hủy theo đơn đã thu hồi.");

        // Cho phép hoàn tác: thao tác nhẹ, bấm nhầm là chuyện thường
        log.Status = taken ? MedicationStatus.Taken : MedicationStatus.Pending;
        log.TakenAt = taken ? DateTime.UtcNow : null;

        await _repository.SaveChangesAsync();
        return Ok(new { message = taken ? "Đã xác nhận uống thuốc." : "Đã hoàn tác." });
    }

    /* ---------------------------- HỖ TRỢ ---------------------------- */

    /// <summary>
    /// Bệnh nhân luôn bị ép về hồ sơ của chính mình, bất kể tham số truyền lên.
    /// Đây là chốt chặn chống việc đổi patientId trên URL để xem hồ sơ người khác.
    /// </summary>
    private int ResolvePatientId(int? requested)
    {
        if (_me.Role == UserRole.Patient) return RequireMyPatientId(_me);
        var pid = requested ?? throw AppException.BadRequest(Msg.RequiredFields, "Cần chỉ định patientId.");
        return pid;
    }

    private async Task<bool> IsAbnormalAsync(MetricType type, decimal value, MetricContext? ctx)
    {
        return type switch
        {
            MetricType.Glucose => ctx == MetricContext.AfterMeal
                ? value > await _cfg.GetDecimalAsync(ConfigKeys.GlucosePostMealMax, 10.0m)
                : value > await _cfg.GetDecimalAsync(ConfigKeys.GlucoseFastingMax, 7.2m),
            MetricType.HbA1c => value > await _cfg.GetDecimalAsync("metric.hba1c_target", 7.0m),
            MetricType.SystolicBp => value >= 140,
            MetricType.DiastolicBp => value >= 90,
            _ => false
        };
    }
}
