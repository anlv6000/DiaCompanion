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

        if (recordedUtc > DateTime.UtcNow)
            throw AppException.BadRequest(Msg.RequiredFields, "Không thể ghi chỉ số ở thời điểm tương lai.");

        if (req.MetricType == MetricType.HbA1c)
            throw AppException.BadRequest(Msg.RequiredFields,
                "HbA1c chỉ được ghi nhận trong lượt khám, không thể tự nhập tại nhà.");

        if (req.MetricType == MetricType.DiastolicBp)
            throw AppException.BadRequest(Msg.RequiredFields,
                "Huyết áp phải được nhập đồng thời cả tâm thu và tâm trương.");

        if (req.MetricType == MetricType.SystolicBp)
        {
            if (req.SystolicValue is null || req.DiastolicValue is null)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Vui lòng nhập đầy đủ huyết áp tâm thu và tâm trương.");

            var systolicValue = req.SystolicValue.Value;
            var diastolicValue = req.DiastolicValue.Value;

            if (systolicValue is < 40m or > 300m)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Huyết áp tâm thu phải nằm trong khoảng 40–300 mmHg.");

            if (diastolicValue is < 20m or > 200m)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Huyết áp tâm trương phải nằm trong khoảng 20–200 mmHg.");

            if (systolicValue <= diastolicValue)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Huyết áp tâm thu phải lớn hơn huyết áp tâm trương.");

            var recordedLocalDate = _clock.ToLocalDate(recordedUtc);

            var systolicMetric = new HealthMetric
            {
                PatientId = pid,
                MetricType = MetricType.SystolicBp,
                Value = systolicValue,
                Unit = "mmHg",
                Context = null,
                RecordedAtUtc = recordedUtc,
                RecordedLocalDate = recordedLocalDate,
                Note = req.Note,
                IsAbnormal = systolicValue >= 140m
            };

            var diastolicMetric = new HealthMetric
            {
                PatientId = pid,
                MetricType = MetricType.DiastolicBp,
                Value = diastolicValue,
                Unit = "mmHg",
                Context = null,
                RecordedAtUtc = recordedUtc,
                RecordedLocalDate = recordedLocalDate,
                Note = req.Note,
                IsAbnormal = diastolicValue >= 90m
            };

            _repository.HealthMetrics.Add(systolicMetric);
            _repository.HealthMetrics.Add(diastolicMetric);
            await _repository.SaveChangesAsync();

            return Ok(new HealthMetricDto
            {
                Id = systolicMetric.Id,
                MetricType = (byte)systolicMetric.MetricType,
                Value = systolicMetric.Value,
                Unit = systolicMetric.Unit,
                Context = null,
                RecordedAtUtc = systolicMetric.RecordedAtUtc,
                RecordedLocalDate = systolicMetric.RecordedLocalDate,
                Note = systolicMetric.Note,
                IsAbnormal = systolicMetric.IsAbnormal || diastolicMetric.IsAbnormal
            });
        }

        if (req.MetricType != MetricType.Glucose)
            throw AppException.BadRequest(Msg.RequiredFields, "Loại chỉ số không hợp lệ.");

        if (req.Context is not (MetricContext.BeforeMeal or MetricContext.AfterMeal))
            throw AppException.BadRequest(Msg.RequiredFields,
                "Thời điểm đo đường huyết phải là trước ăn hoặc sau ăn.");

        if (req.Value is < 1m or > 40m)
            throw AppException.BadRequest(Msg.RequiredFields,
                "Giá trị phải nằm trong khoảng 1–40 mmol/L.");

        var metric = new HealthMetric
        {
            PatientId = pid,
            MetricType = MetricType.Glucose,
            Value = req.Value,
            Unit = "mmol/L",
            Context = req.Context,
            RecordedAtUtc = recordedUtc,
            RecordedLocalDate = _clock.ToLocalDate(recordedUtc),
            Note = req.Note,
            IsAbnormal = await IsAbnormalAsync(MetricType.Glucose, req.Value, req.Context)
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

        if (m.MetricType == MetricType.HbA1c)
            throw AppException.BadRequest(Msg.Forbidden,
                "HbA1c chỉ được ghi nhận trong lượt khám, không thể sửa như chỉ số tự nhập tại nhà.");

        if (m.MetricType is MetricType.SystolicBp or MetricType.DiastolicBp)
        {
            if (req.MetricType != MetricType.SystolicBp)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Huyết áp phải được sửa bằng metricType tâm thu và nhập đủ tâm thu, tâm trương.");

            if (req.SystolicValue is null || req.DiastolicValue is null)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Vui lòng nhập đầy đủ huyết áp tâm thu và tâm trương.");

            var systolicValue = req.SystolicValue.Value;
            var diastolicValue = req.DiastolicValue.Value;

            if (systolicValue is < 40m or > 300m)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Huyết áp tâm thu phải nằm trong khoảng 40–300 mmHg.");

            if (diastolicValue is < 20m or > 200m)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Huyết áp tâm trương phải nằm trong khoảng 20–200 mmHg.");

            if (systolicValue <= diastolicValue)
                throw AppException.BadRequest(Msg.RequiredFields,
                    "Huyết áp tâm thu phải lớn hơn huyết áp tâm trương.");

            var systolicMetric = m.MetricType == MetricType.SystolicBp
                ? m
                : await FindBloodPressurePairAsync(m, MetricType.SystolicBp);

            var diastolicMetric = m.MetricType == MetricType.DiastolicBp
                ? m
                : await FindBloodPressurePairAsync(m, MetricType.DiastolicBp);

            var recordedUtc = m.RecordedAtUtc;
            var recordedLocalDate = m.RecordedLocalDate;

            if (req.RecordedAtUtc.HasValue)
            {
                recordedUtc = DateTime.SpecifyKind(req.RecordedAtUtc.Value, DateTimeKind.Utc);
                if (recordedUtc > _clock.UtcNow)
                    throw AppException.BadRequest(Msg.RequiredFields, "Không thể ghi chỉ số ở thời điểm tương lai.");

                recordedLocalDate = _clock.ToLocalDate(recordedUtc);
            }

            systolicMetric.Value = systolicValue;
            systolicMetric.Note = req.Note;
            systolicMetric.RecordedAtUtc = recordedUtc;
            systolicMetric.RecordedLocalDate = recordedLocalDate;
            systolicMetric.IsAbnormal = systolicValue >= 140m;

            diastolicMetric.Value = diastolicValue;
            diastolicMetric.Note = req.Note;
            diastolicMetric.RecordedAtUtc = recordedUtc;
            diastolicMetric.RecordedLocalDate = recordedLocalDate;
            diastolicMetric.IsAbnormal = diastolicValue >= 90m;

            await _repository.SaveChangesAsync();

            return Ok(new HealthMetricDto
            {
                Id = systolicMetric.Id,
                MetricType = (byte)systolicMetric.MetricType,
                Value = systolicMetric.Value,
                Unit = systolicMetric.Unit,
                Context = null,
                RecordedAtUtc = systolicMetric.RecordedAtUtc,
                RecordedLocalDate = systolicMetric.RecordedLocalDate,
                Note = systolicMetric.Note,
                IsAbnormal = systolicMetric.IsAbnormal || diastolicMetric.IsAbnormal
            });
        }

        if (req.MetricType != MetricType.Glucose)
            throw AppException.BadRequest(Msg.RequiredFields, "Loại chỉ số không hợp lệ.");

        if (req.Context is not (MetricContext.BeforeMeal or MetricContext.AfterMeal))
            throw AppException.BadRequest(Msg.RequiredFields,
                "Thời điểm đo đường huyết phải là trước ăn hoặc sau ăn.");

        if (req.Value is < 1m or > 40m)
            throw AppException.BadRequest(Msg.RequiredFields,
                "Giá trị phải nằm trong khoảng 1–40 mmol/L.");

        if (req.RecordedAtUtc.HasValue)
        {
            var recordedUtc = DateTime.SpecifyKind(req.RecordedAtUtc.Value, DateTimeKind.Utc);
            if (recordedUtc > _clock.UtcNow)
                throw AppException.BadRequest(Msg.RequiredFields, "Không thể ghi chỉ số ở thời điểm tương lai.");

            m.RecordedAtUtc = recordedUtc;
            m.RecordedLocalDate = _clock.ToLocalDate(recordedUtc);
        }

        m.Value = req.Value;
        m.Context = req.Context;
        m.Note = req.Note;
        m.IsAbnormal = await IsAbnormalAsync(m.MetricType, req.Value, req.Context);

        await _repository.SaveChangesAsync();

        return Ok(new HealthMetricDto
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
        });
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

        if (m.MetricType == MetricType.HbA1c)
            throw AppException.BadRequest(Msg.Forbidden,
                "HbA1c chỉ được ghi nhận trong lượt khám, không thể xóa như chỉ số tự nhập tại nhà.");

        var deletedAt = _clock.UtcNow;
        m.IsDeleted = true;
        m.DeletedAt = deletedAt;

        if (m.MetricType is MetricType.SystolicBp or MetricType.DiastolicBp)
        {
            var oppositeType = m.MetricType == MetricType.SystolicBp
                ? MetricType.DiastolicBp
                : MetricType.SystolicBp;

            var pair = await FindBloodPressurePairAsync(m, oppositeType);
            pair.IsDeleted = true;
            pair.DeletedAt = deletedAt;
        }

        await _repository.SaveChangesAsync();

        return Ok(new { message = "Đã ẩn bản ghi. Dữ liệu vẫn được lưu cho bác sĩ đối chiếu." });
    }
    private async Task<HealthMetric> FindBloodPressurePairAsync(HealthMetric metric, MetricType pairType)
    {
        return await _repository.HealthMetrics.FirstOrDefaultAsync(x =>
                   x.PatientId == metric.PatientId &&
                   x.RecordedAtUtc == metric.RecordedAtUtc &&
                   x.MetricType == pairType)
               ?? throw AppException.BadRequest(Msg.LoadFailed,
                   "Không tìm thấy đủ cặp huyết áp tâm thu và tâm trương.");
    }


    /// <summary>UC-48 — tóm tắt để vẽ biểu đồ xu hướng.</summary>
    public async Task<ActionResult<MetricSummaryDto>> Summary(int patientId, [FromQuery] int days = 30)
    {
        EnsureCanAccessPatient(_me, patientId);

        if (days is < 1 or > 365)
            throw AppException.BadRequest(Msg.RequiredFields, "Khoảng thời gian xem biểu đồ phải từ 1 đến 365 ngày.");

        var today = _clock.LocalToday;
        var from = today.AddDays(-(days - 1));

        var metrics = await _repository.HealthMetrics.AsNoTracking()
            .Where(m => m.PatientId == patientId
                        && m.RecordedLocalDate >= from
                        && m.RecordedLocalDate <= today)
            .ToListAsync();

        var glucose = metrics.Where(m => m.MetricType == MetricType.Glucose).ToList();
        var hba1c = metrics.Where(m => m.MetricType == MetricType.HbA1c).ToList();
        var bloodPressure = metrics
            .Where(m => m.MetricType is MetricType.SystolicBp or MetricType.DiastolicBp)
            .GroupBy(m => m.RecordedAtUtc)
            .Select(g =>
            {
                var systolic = g.OrderByDescending(m => m.Id)
                    .FirstOrDefault(m => m.MetricType == MetricType.SystolicBp);
                var diastolic = g.OrderByDescending(m => m.Id)
                    .FirstOrDefault(m => m.MetricType == MetricType.DiastolicBp);

                return systolic is null || diastolic is null
                    ? null
                    : new BloodPressurePair(
                        systolic,
                        diastolic,
                        systolic.IsAbnormal || diastolic.IsAbnormal);
            })
            .Where(p => p is not null)
            .Select(p => p!)
            .ToList();

        var glucoseAbnormalCount = glucose.Count(m => m.IsAbnormal);
        var hba1cAbnormalCount = hba1c.Count(m => m.IsAbnormal);
        var bloodPressureAbnormalCount = bloodPressure.Count(p => p.IsAbnormal);

        return Ok(new MetricSummaryDto
        {
            Days = days,
            From = from,
            To = today,
            TotalAbnormalCount = glucoseAbnormalCount + hba1cAbnormalCount + bloodPressureAbnormalCount,
            Glucose = new MetricTrendDto
            {
                Average = glucose.Count > 0 ? Math.Round(glucose.Average(m => m.Value), 1) : (decimal?)null,
                Latest = ToLatest(glucose.OrderByDescending(m => m.RecordedAtUtc).FirstOrDefault()),
                AbnormalCount = glucoseAbnormalCount,
                // Gom theo ngày ĐỊA PHƯƠNG để trục hoành biểu đồ đúng ngày bệnh nhân đo.
                Chart = glucose.GroupBy(m => m.RecordedLocalDate)
                    .OrderBy(g => g.Key)
                    .Select(g => new MetricChartPointDto
                    {
                        Date = g.Key,
                        Value = Math.Round(g.Average(m => m.Value), 1),
                        Count = g.Count(),
                        AbnormalCount = g.Count(m => m.IsAbnormal),
                        IsAbnormal = g.Any(m => m.IsAbnormal)
                    })
                    .ToList()
            },
            HbA1c = new MetricTrendDto
            {
                Average = hba1c.Count > 0 ? Math.Round(hba1c.Average(m => m.Value), 1) : (decimal?)null,
                Latest = ToLatest(hba1c.OrderByDescending(m => m.RecordedAtUtc).FirstOrDefault()),
                AbnormalCount = hba1cAbnormalCount,
                Chart = hba1c.OrderBy(m => m.RecordedAtUtc)
                    .Select(m => new MetricChartPointDto
                    {
                        Date = m.RecordedLocalDate,
                        RecordedAtUtc = m.RecordedAtUtc,
                        Value = m.Value,
                        Count = 1,
                        AbnormalCount = m.IsAbnormal ? 1 : 0,
                        IsAbnormal = m.IsAbnormal
                    })
                    .ToList()
            },
            BloodPressure = new BloodPressureTrendDto
            {
                AverageSystolic = bloodPressure.Count > 0
                    ? Math.Round(bloodPressure.Average(p => p.Systolic.Value), 1)
                    : (decimal?)null,
                AverageDiastolic = bloodPressure.Count > 0
                    ? Math.Round(bloodPressure.Average(p => p.Diastolic.Value), 1)
                    : (decimal?)null,
                Latest = bloodPressure.OrderByDescending(p => p.Systolic.RecordedAtUtc)
                    .Select(p => new BloodPressureLatestDto
                    {
                        SystolicId = p.Systolic.Id,
                        DiastolicId = p.Diastolic.Id,
                        Systolic = p.Systolic.Value,
                        Diastolic = p.Diastolic.Value,
                        Unit = "mmHg",
                        RecordedAtUtc = p.Systolic.RecordedAtUtc,
                        RecordedLocalDate = p.Systolic.RecordedLocalDate,
                        IsAbnormal = p.IsAbnormal
                    })
                    .FirstOrDefault(),
                AbnormalCount = bloodPressureAbnormalCount,
                Chart = bloodPressure.OrderBy(p => p.Systolic.RecordedAtUtc)
                    .Select(p => new BloodPressureChartPointDto
                    {
                        Date = p.Systolic.RecordedLocalDate,
                        RecordedAtUtc = p.Systolic.RecordedAtUtc,
                        Systolic = p.Systolic.Value,
                        Diastolic = p.Diastolic.Value,
                        IsAbnormal = p.IsAbnormal
                    })
                    .ToList()
            }
        });

        static MetricLatestDto? ToLatest(HealthMetric? m) => m is null
            ? null
            : new MetricLatestDto
            {
                Id = m.Id,
                MetricType = (byte)m.MetricType,
                Value = m.Value,
                Unit = m.Unit,
                Context = (byte?)m.Context,
                RecordedAtUtc = m.RecordedAtUtc,
                RecordedLocalDate = m.RecordedLocalDate,
                IsAbnormal = m.IsAbnormal
            };
    }
    private sealed record BloodPressurePair(
    HealthMetric Systolic,
    HealthMetric Diastolic,
    bool IsAbnormal);

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
        switch (type)
        {
            case MetricType.Glucose:
                {
                    var glucoseMin = await _cfg.GetDecimalAsync(ConfigKeys.GlucoseMin, 3.9m);
                    var fastingMax = await _cfg.GetDecimalAsync(ConfigKeys.GlucoseFastingMax, 7.2m);
                    var postMealMax = await _cfg.GetDecimalAsync(ConfigKeys.GlucosePostMealMax, 10.0m);

                    return ctx switch
                    {
                        MetricContext.BeforeMeal => value < glucoseMin || value > fastingMax,
                        MetricContext.AfterMeal => value < glucoseMin || value > postMealMax,
                        _ => false
                    };
                }

            case MetricType.HbA1c:
                return value > await _cfg.GetDecimalAsync("metric.hba1c_target", 7.0m);

            case MetricType.SystolicBp:
                return value >= 140;

            case MetricType.DiastolicBp:
                return value >= 90;

            default:
                return false;
        }

    }
    
}
