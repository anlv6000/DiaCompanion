using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-53, UC-58..61 — thống kê và quản trị hệ thống.</summary>
public class AdminService : BaseService, IAdminService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public AdminService(IRepository repository, ICurrentUser me, IAuditService audit, IClinicClock clock)
    { _repository = repository; _me = me; _audit = audit; _clock = clock; }

    /* ----------------------------- UC-53 DASHBOARD ----------------------- */
    public async Task<ActionResult<DashboardDto>> Dashboard(
        DateOnly? from,
        DateOnly? to,
        int? modelVersionId)
    {
        var localFrom = from ?? new DateOnly(_clock.LocalNow.Year, _clock.LocalNow.Month, 1);
        var localTo = to ?? _clock.LocalToday;
        if (localTo < localFrom)
            throw AppException.BadRequest(Msg.InvalidData, "Ngày kết thúc phải từ ngày bắt đầu trở đi.");

        var fromUtc = _clock.ToUtc(localFrom.ToDateTime(TimeOnly.MinValue));
        var toExclusiveUtc = _clock.ToUtc(localTo.AddDays(1).ToDateTime(TimeOnly.MinValue));

        var diagnoses = _repository.AiDiagnoses.AsNoTracking()
            .Where(d => d.CreatedAt >= fromUtc && d.CreatedAt < toExclusiveUtc);
        var reviews = _repository.DiagnosisReviews.AsNoTracking()
            .Where(r => r.CreatedAt >= fromUtc && r.CreatedAt < toExclusiveUtc);
        var visits = _repository.Visits.AsNoTracking()
            .Where(v => v.VisitDate >= fromUtc && v.VisitDate < toExclusiveUtc);

        if (_me.Role == UserRole.Doctor)
        {
            var doctorId = _me.RequireId();
            diagnoses = diagnoses.Where(d => d.FundusImage!.Visit != null
                                               && d.FundusImage.Visit.DoctorId == doctorId);
            reviews = reviews.Where(r => r.AiDiagnosis!.FundusImage!.Visit != null
                                           && r.AiDiagnosis.FundusImage.Visit.DoctorId == doctorId);
            visits = visits.Where(v => v.DoctorId == doctorId);
        }

        if (modelVersionId is int selectedModelId)
        {
            diagnoses = diagnoses.Where(d => d.ModelVersionId == selectedModelId);
            reviews = reviews.Where(r => r.AiDiagnosis!.ModelVersionId == selectedModelId);
        }

        var totalDiagnoses = await diagnoses.CountAsync();
        var deferredTotal = await diagnoses.CountAsync(d => d.IsDeferred);
        var totalReviews = await reviews.CountAsync();
        var overrides = await reviews.CountAsync(r => r.Action == ReviewAction.Override);
        var closedVisits = await visits.CountAsync(v => v.Status == VisitStatus.Completed);
        var referred = await visits.CountAsync(v => v.Status == VisitStatus.Completed
                                                   && v.Referral.HasValue
                                                   && v.Referral.Value >= ReferralType.Ophthalmology);

        var gradeDistribution = await reviews
            .GroupBy(r => r.FinalGrade)
            .Select(g => new { Grade = (byte)g.Key, Count = g.Count() })
            .ToListAsync();

        var patientCount = await visits.Select(v => v.PatientId).Distinct().CountAsync();
        if (_me.Role == UserRole.Admin && from is null && to is null)
            patientCount = await _repository.Patients.CountAsync();

        return Ok(new DashboardDto
        {
            PeriodFrom = localFrom,
            PeriodTo = localTo,
            ModelVersionId = modelVersionId,
            Scope = _me.Role == UserRole.Doctor ? "AssignedDoctor" : "System",
            TotalPatients = patientCount,
            VisitsThisMonth = await visits.CountAsync(),
            PendingTriage = await diagnoses.CountAsync(d => !d.Reviews.Any()),
            DeferredPending = await diagnoses.CountAsync(d => !d.Reviews.Any() && d.IsDeferred),
            DeferralRate = Pct(deferredTotal, totalDiagnoses),
            ReferralRate = Pct(referred, closedVisits),
            OverrideRate = Pct(overrides, totalReviews),
            GradeDistribution = gradeDistribution.ToDictionary(
                x => DiagnosesService.GradeLabel(x.Grade), x => x.Count),
            ActiveModel = await _repository.ModelVersions.AsNoTracking()
                .Where(m => m.IsActive)
                .Select(m => m.Name)
                .FirstOrDefaultAsync() ?? "(chưa kích hoạt)"
        });
    }

    /* --------------------------- UC-58 CẤU HÌNH ------------------------- */
    public async Task<ActionResult<List<SystemConfigDto>>> Configs()
    {
        var rows = await _repository.SystemConfigs.AsNoTracking()
            .OrderBy(c => c.Key)
            .ToListAsync();

        var items = rows.Select(c => new SystemConfigDto
        {
            Key = c.Key,
            Value = c.Value,
            ValueType = c.ValueType,
            Description = c.Description,
            MinValue = c.MinValue,
            MaxValue = c.MaxValue,
            UpdatedAt = c.UpdatedAt,
            RowVersion = c.ToRowVersion()
        }).ToList();

        return Ok(items);
    }

    /// <summary>
    /// UC-58 — đổi ngưỡng.
    /// Giá trị mới CHỈ áp dụng cho các ca chạy SAU thời điểm này; kết quả đã lưu
    /// giữ nguyên ngưỡng tại thời điểm chạy (A1 của UC-28, BR-17).
    /// </summary>
    public async Task<IActionResult> UpdateConfig(string key, UpdateConfigRequest req)
    {
        var cfg = await _repository.SystemConfigs.FirstOrDefaultAsync(c => c.Key == key)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy khóa cấu hình.");

        _repository.ApplyOriginalRowVersion(cfg, req.RowVersion);

        if (cfg.ValueType is "decimal" or "int")
        {
            if (!decimal.TryParse(req.Value, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var num))
                throw AppException.BadRequest(Msg.ThresholdRange, "Giá trị phải là số.");

            if (cfg.MinValue is decimal min && num < min)
                throw AppException.BadRequest(Msg.ThresholdRange,
                    $"Giá trị phải nằm trong khoảng {cfg.MinValue} đến {cfg.MaxValue}.");
            if (cfg.MaxValue is decimal max && num > max)
                throw AppException.BadRequest(Msg.ThresholdRange,
                    $"Giá trị phải nằm trong khoảng {cfg.MinValue} đến {cfg.MaxValue}.");
        }

        var oldValue = cfg.Value;
        cfg.Value = req.Value;
        cfg.UpdatedBy = _me.RequireId();
        cfg.UpdatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.ConfigChange, nameof(SystemConfig), null,
            new { key, value = oldValue }, new { key, value = req.Value });
        await _repository.SaveChangesAsync();

        return Ok(new
        {
            message = "Cập nhật cấu hình thành công.",
            rowVersion = cfg.ToRowVersion()
        });
    }

    /// <summary>
    /// UC-58 bước 4 — ước tính ảnh hưởng TRƯỚC khi đổi ngưỡng.
    ///
    /// Đây là điểm cân bằng giữa mức tự động và mức an toàn: hạ ngưỡng thì ít ca
    /// chuyển bác sĩ hơn (nhanh hơn nhưng rủi ro hơn), nâng ngưỡng thì ngược lại.
    /// Admin cần thấy con số trước khi quyết định.
    /// </summary>
    public async Task<ActionResult<ThresholdImpactDto>> ThresholdImpact(
        [FromQuery] string key, [FromQuery] decimal proposed)
    {
        if (key is not (ConfigKeys.ConfidenceThreshold or ConfigKeys.DisagreementThreshold))
            throw AppException.BadRequest(Msg.RequiredFields,
                "Chỉ ước tính được cho ngưỡng tin cậy hoặc ngưỡng bất đồng.");

        var current = await _repository.SystemConfigs.Where(c => c.Key == key).Select(c => c.Value).FirstOrDefaultAsync();
        var currentVal = decimal.TryParse(current, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var cv) ? cv : 0m;

        var otherKey = key == ConfigKeys.ConfidenceThreshold
            ? ConfigKeys.DisagreementThreshold : ConfigKeys.ConfidenceThreshold;
        var otherRaw = await _repository.SystemConfigs.Where(c => c.Key == otherKey).Select(c => c.Value).FirstOrDefaultAsync();
        var otherVal = decimal.TryParse(otherRaw, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var ov) ? ov : 0m;

        var rows = await _repository.AiDiagnoses.AsNoTracking()
            .Select(d => new { d.Confidence, d.Disagreement, d.IsDeferred }).ToListAsync();

        int projected = key == ConfigKeys.ConfidenceThreshold
            ? rows.Count(r => r.Confidence < proposed || (r.Disagreement ?? 0) > otherVal)
            : rows.Count(r => r.Confidence < otherVal || (r.Disagreement ?? 0) > proposed);

        var currentDeferred = rows.Count(r => r.IsDeferred);

        return Ok(new ThresholdImpactDto
        {
            CurrentThreshold = currentVal,
            ProposedThreshold = proposed,
            TotalCases = rows.Count,
            CurrentDeferred = currentDeferred,
            ProjectedDeferred = projected,
            CurrentRate = Pct(currentDeferred, rows.Count),
            ProjectedRate = Pct(projected, rows.Count),
            Note = "Ước tính trên dữ liệu lịch sử. Ngưỡng mới chỉ áp dụng cho các ca chạy sau khi lưu; " +
                   "kết quả đã có giữ nguyên ngưỡng tại thời điểm chạy."
        });
    }

    /* --------------------------- UC-59, 60 MODEL ------------------------ */
    public async Task<ActionResult<List<ModelVersionDto>>> Models()
    {
        var models = await _repository.ModelVersions.AsNoTracking()
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();

        var modelIds = models.Select(m => m.Id).ToList();
        var counts = await _repository.AiDiagnoses.AsNoTracking()
            .Where(d => modelIds.Contains(d.ModelVersionId))
            .GroupBy(d => d.ModelVersionId)
            .Select(g => new { ModelVersionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ModelVersionId, x => x.Count);

        var items = models
            .Select(m => MapModel(m, counts.GetValueOrDefault(m.Id)))
            .ToList();

        return Ok(items);
    }

    /// <summary>UC-59 — đăng ký phiên bản mới.</summary>
    public async Task<ActionResult<ModelVersionDto>> RegisterModel(RegisterModelRequest req)
    {
        var sha256 = req.Sha256.Trim().ToLowerInvariant();
        if (sha256.Length != 64 || sha256.Any(c => !Uri.IsHexDigit(c)))
            throw AppException.BadRequest(Msg.InvalidData, "SHA-256 phải gồm đúng 64 ký tự hệ 16.");

        foreach (var metric in new[] { req.Qwk, req.Dice, req.IoU })
        {
            if (metric is decimal value && (value < 0 || value > 1))
                throw AppException.BadRequest(Msg.InvalidData, "QWK, Dice và IoU phải nằm trong khoảng 0 đến 1.");
        }

        if (req.Qwk is null && req.Dice is null && req.IoU is null)
            throw AppException.BadRequest(
                Msg.RequiredFields,
                "Cần nhập ít nhất một chỉ số đánh giá QWK, Dice hoặc IoU cho phiên bản mô hình.");

        if (await _repository.ModelVersions.AnyAsync(m => m.Name == req.Name.Trim()))
            throw AppException.Conflict(Msg.InvalidData, "Tên phiên bản mô hình đã tồn tại.");

        var model = new ModelVersion
        {
            Name = req.Name.Trim(),
            FilePath = req.FilePath.Trim(),
            Sha256 = sha256,
            Qwk = req.Qwk,
            Dice = req.Dice,
            IoU = req.IoU,
            Note = req.Note,
            IsActive = false,
            WasActivated = false,
            CreatedBy = _me.RequireId()
        };

        _repository.ModelVersions.Add(model);
        await _repository.SaveChangesAsync();

        await _audit.LogAsync(AuditAction.ModelRegister, nameof(ModelVersion), model.Id,
            null, new { model.Name, model.Sha256, model.Qwk, model.Dice, model.IoU });
        await _repository.SaveChangesAsync();

        return Ok(await GetModelDtoAsync(model.Id));
    }

    /// <summary>
    /// UC-59 — kích hoạt phiên bản.
    /// BR-15: chỉ một phiên bản kích hoạt tại một thời điểm.
    /// </summary>
    public async Task<IActionResult> ActivateModel(int id, ConcurrencyRequest req)
    {
        var strategy = _repository.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var tx = await _repository.Database.BeginTransactionAsync();
            try
            {
                var model = await _repository.ModelVersions.FirstOrDefaultAsync(m => m.Id == id)
                    ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy phiên bản mô hình.");

                _repository.ApplyOriginalRowVersion(model, req.RowVersion);

                if (model.Qwk is null && model.Dice is null && model.IoU is null)
                    throw AppException.BadRequest(
                        Msg.RequiredFields,
                        "Phiên bản chưa có chỉ số đánh giá nên không thể kích hoạt.");

                if (model.IsActive)
                {
                    await tx.RollbackAsync();
                    return Ok(new
                    {
                        message = "Phiên bản này đang được sử dụng.",
                        rowVersion = model.ToRowVersion()
                    });
                }

                // Gỡ phiên bản cũ trước khi bật bản mới. Unique index tại CSDL
                // vẫn là chốt chặn cuối để chỉ có một IsActive = 1.
                var current = await _repository.ModelVersions
                    .Where(m => m.IsActive && m.Id != model.Id)
                    .ToListAsync();
                foreach (var activeModel in current)
                    activeModel.IsActive = false;

                model.IsActive = true;
                model.WasActivated = true;
                model.ActivatedAt = _clock.UtcNow;

                await _audit.LogAsync(
                    AuditAction.ModelActivate,
                    nameof(ModelVersion),
                    model.Id,
                    new { active = current.FirstOrDefault()?.Name },
                    new { active = model.Name });
                await _repository.SaveChangesAsync();
                await tx.CommitAsync();

                return Ok(new
                {
                    message = $"Đã kích hoạt {model.Name}. Các ca chạy sau thời điểm này sẽ dùng phiên bản mới; " +
                              "kết quả đã lưu giữ nguyên phiên bản cũ.",
                    rowVersion = model.ToRowVersion()
                });
            }
            catch (DbUpdateConcurrencyException)
            {
                await tx.RollbackAsync();
                throw AppException.Conflict(
                    Msg.StaleVersion,
                    "Trạng thái phiên bản mô hình đã thay đổi. Vui lòng tải lại trước khi kích hoạt.");
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        });
    }

    /// <summary>UC-60 — xoá phiên bản CHƯA TỪNG kích hoạt (BR-16).</summary>
    public async Task<IActionResult> DeleteModel(int id, string rowVersion)
    {
        var model = await _repository.ModelVersions.FirstOrDefaultAsync(m => m.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy phiên bản mô hình.");

        _repository.ApplyOriginalRowVersion(model, rowVersion);

        if (model.WasActivated || model.IsActive)
            throw AppException.BadRequest(Msg.ModelWasActive,
                "Không thể xóa phiên bản mô hình đã từng được kích hoạt.");

        // Chốt chặn thứ hai: nếu có kết quả tham chiếu thì xoá sẽ làm mồ côi dữ liệu
        if (await _repository.AiDiagnoses.AnyAsync(d => d.ModelVersionId == id))
            throw AppException.BadRequest(Msg.ModelWasActive,
                "Phiên bản này đã sinh ra kết quả chẩn đoán nên không thể xóa.");

        _repository.ModelVersions.Remove(model);
        await _audit.LogAsync(AuditAction.ModelDelete, nameof(ModelVersion), model.Id,
            new { model.Name }, null);
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Đã xóa phiên bản mô hình." });
    }

    /* ---------------------------- UC-61 AUDIT --------------------------- */

    /// <summary>
    /// UC-61 — nhật ký audit, KEYSET pagination.
    ///
    /// Bảng này lớn nhất và được lật sâu nhất, mà OFFSET phải quét bỏ n dòng
    /// đầu nên trang sâu rất chậm. Cũng cố ý KHÔNG trả tổng số: COUNT(*) trên
    /// bảng hàng triệu dòng thường tốn hơn chính câu lấy trang.
    /// </summary>
    public async Task<ActionResult<KeysetResult<AuditLogDto>>> Audit(
        [FromQuery] string? action, [FromQuery] string? entityType, [FromQuery] int? entityId,
        [FromQuery] int? userId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? cursor, [FromQuery] int size = 25)
    {
        size = size is < 1 or > 100 ? 25 : size;
        var query = _repository.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action == action);
        if (!string.IsNullOrWhiteSpace(entityType)) query = query.Where(a => a.EntityType == entityType);
        if (entityId is int eid) query = query.Where(a => a.EntityId == eid);
        if (userId is int uid) query = query.Where(a => a.UserId == uid);
        if (from is DateTime f) query = query.Where(a => a.CreatedAt >= f);
        if (to is DateTime t) query = query.Where(a => a.CreatedAt <= t);

        var decoded = Cursor.Decode(cursor);
        if (decoded is (DateTime at, long lastId))
            query = query.Where(a => a.CreatedAt < at || (a.CreatedAt == at && a.Id < lastId));

        var rows = await query.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
            .Take(size + 1).ToListAsync();

        var hasMore = rows.Count > size;
        if (hasMore) rows.RemoveAt(rows.Count - 1);

        var items = rows.Select(a => new AuditLogDto
        {
            Id = a.Id,
            UserName = a.UserName,
            Action = a.Action,
            EntityType = a.EntityType,
            EntityId = a.EntityId,
            OldValue = a.OldValue,
            NewValue = a.NewValue,
            Detail = a.Detail,
            IpAddress = a.IpAddress,
            CreatedAt = a.CreatedAt
        }).ToList();

        var last = rows.LastOrDefault();
        return Ok(new KeysetResult<AuditLogDto>
        {
            Items = items,
            NextCursor = hasMore && last is not null ? Cursor.Encode(last.CreatedAt, last.Id) : null
        });
    }

    private static decimal Pct(int part, int total) =>
        total == 0 ? 0 : Math.Round(part * 100m / total, 1);

    private async Task<ModelVersionDto> GetModelDtoAsync(int id)
    {
        var model = await _repository.ModelVersions.AsNoTracking()
            .FirstAsync(m => m.Id == id);
        var diagnosisCount = await _repository.AiDiagnoses.AsNoTracking()
            .CountAsync(d => d.ModelVersionId == id);

        return MapModel(model, diagnosisCount);
    }

    private static ModelVersionDto MapModel(ModelVersion m, int diagnosisCount) => new()
    {
        Id = m.Id,
        Name = m.Name,
        FilePath = m.FilePath,
        Sha256 = m.Sha256,
        Qwk = m.Qwk,
        Dice = m.Dice,
        IoU = m.IoU,
        Note = m.Note,
        IsActive = m.IsActive,
        WasActivated = m.WasActivated,
        ActivatedAt = m.ActivatedAt,
        DiagnosisCount = diagnosisCount,
        RowVersion = m.ToRowVersion()
    };
}
