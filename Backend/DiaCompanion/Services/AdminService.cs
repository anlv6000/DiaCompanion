using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-58, UC-63..66 — quản trị hệ thống.</summary>
public class AdminService : BaseService, IAdminService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public AdminService(IRepository repository, ICurrentUser me, IAuditService audit, IClinicClock clock)
    { _repository = repository; _me = me; _audit = audit; _clock = clock; }

    /* ----------------------------- UC-58 DASHBOARD ----------------------- */
    public async Task<ActionResult<DashboardDto>> Dashboard()
    {
        var monthStart = new DateTime(_clock.LocalNow.Year, _clock.LocalNow.Month, 1);

        var totalDiagnoses = await _repository.AiDiagnoses.CountAsync();
        var deferredTotal = await _repository.AiDiagnoses.CountAsync(d => d.IsDeferred);
        var reviews = await _repository.DiagnosisReviews.CountAsync();
        var overrides = await _repository.DiagnosisReviews.CountAsync(r => r.Action == ReviewAction.Override);
        var referred = await _repository.Visits.CountAsync(v => v.Referral >= ReferralType.Ophthalmology);
        var closedVisits = await _repository.Visits.CountAsync(v => v.Status == VisitStatus.Completed);

        var gradeDist = await _repository.DiagnosisReviews
            .GroupBy(r => r.FinalGrade)
            .Select(g => new { Grade = (byte)g.Key, Count = g.Count() })
            .ToListAsync();

        return Ok(new DashboardDto
        {
            TotalPatients = await _repository.Patients.CountAsync(),
            VisitsThisMonth = await _repository.Visits.CountAsync(v => v.VisitDate >= monthStart),
            PendingTriage = await _repository.AiDiagnoses.CountAsync(d => !d.Reviews.Any()),
            DeferredPending = await _repository.AiDiagnoses.CountAsync(d => !d.Reviews.Any() && d.IsDeferred),
            DeferralRate = Pct(deferredTotal, totalDiagnoses),
            ReferralRate = Pct(referred, closedVisits),
            OverrideRate = Pct(overrides, reviews),
            GradeDistribution = gradeDist.ToDictionary(
                x => DiagnosesService.GradeLabel(x.Grade), x => x.Count),
            ActiveModel = await _repository.ModelVersions.Where(m => m.IsActive)
                .Select(m => m.Name).FirstOrDefaultAsync() ?? "(chưa kích hoạt)"
        });
    }

    /* --------------------------- UC-63 CẤU HÌNH ------------------------- */
    public async Task<ActionResult<List<SystemConfigDto>>> Configs()
    {
        var items = await _repository.SystemConfigs.AsNoTracking().OrderBy(c => c.Key)
            .Select(c => new SystemConfigDto
            {
                Key = c.Key,
                Value = c.Value,
                ValueType = c.ValueType,
                Description = c.Description,
                MinValue = c.MinValue,
                MaxValue = c.MaxValue,
                UpdatedAt = c.UpdatedAt
            }).ToListAsync();
        return Ok(items);
    }

    /// <summary>
    /// UC-63 — đổi ngưỡng.
    /// Giá trị mới CHỈ áp dụng cho các ca chạy SAU thời điểm này; kết quả đã lưu
    /// giữ nguyên ngưỡng tại thời điểm chạy (A1 của UC-28, BR-17).
    /// </summary>
    public async Task<IActionResult> UpdateConfig(string key, UpdateConfigRequest req)
    {
        var cfg = await _repository.SystemConfigs.FirstOrDefaultAsync(c => c.Key == key)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy khóa cấu hình.");

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

        return Ok(new { message = "Cập nhật cấu hình thành công." });
    }

    /// <summary>
    /// UC-63 bước 4 — ước tính ảnh hưởng TRƯỚC khi đổi ngưỡng.
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

    /* --------------------------- UC-64, 65 MODEL ------------------------ */
    public async Task<ActionResult<List<ModelVersionDto>>> Models()
    {
        var items = await _repository.ModelVersions.AsNoTracking().OrderByDescending(m => m.CreatedAt)
            .Select(m => new ModelVersionDto
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
                DiagnosisCount = _repository.AiDiagnoses.Count(d => d.ModelVersionId == m.Id)
            }).ToListAsync();
        return Ok(items);
    }

    /// <summary>UC-64 — đăng ký phiên bản mới.</summary>
    public async Task<ActionResult<ModelVersionDto>> RegisterModel(RegisterModelRequest req)
    {
        if (await _repository.ModelVersions.AnyAsync(m => m.Name == req.Name))
            throw AppException.Conflict(Msg.PhoneTaken, "Tên phiên bản mô hình đã tồn tại.");

        var model = new ModelVersion
        {
            Name = req.Name.Trim(),
            FilePath = req.FilePath.Trim(),
            Sha256 = req.Sha256.Trim().ToLowerInvariant(),
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
    /// UC-64 — kích hoạt phiên bản.
    /// BR-15: chỉ một phiên bản kích hoạt tại một thời điểm.
    /// </summary>
    public async Task<IActionResult> ActivateModel(int id)
    {
        var model = await _repository.ModelVersions.FirstOrDefaultAsync(m => m.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy phiên bản mô hình.");

        if (model.IsActive) return Ok(new { message = "Phiên bản này đang được sử dụng." });

        await using var tx = await _repository.Database.BeginTransactionAsync();

        // Gỡ phiên bản cũ TRƯỚC khi bật cái mới — unique index chỉ cho phép
        // đúng một bản ghi IsActive = 1 tại mọi thời điểm.
        var current = await _repository.ModelVersions.Where(m => m.IsActive).ToListAsync();
        foreach (var m in current) m.IsActive = false;
        await _repository.SaveChangesAsync();

        model.IsActive = true;
        model.WasActivated = true;   // BR-16: từ nay cấm xoá
        model.ActivatedAt = DateTime.UtcNow;

        await _audit.LogAsync(AuditAction.ModelActivate, nameof(ModelVersion), model.Id,
            new { active = current.FirstOrDefault()?.Name }, new { active = model.Name });
        await _repository.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new
        {
            message = $"Đã kích hoạt {model.Name}. Các ca chạy sau thời điểm này sẽ dùng phiên bản mới; " +
                      "kết quả đã lưu giữ nguyên phiên bản cũ."
        });
    }

    /// <summary>UC-65 — xoá phiên bản CHƯA TỪNG kích hoạt (BR-16).</summary>
    public async Task<IActionResult> DeleteModel(int id)
    {
        var model = await _repository.ModelVersions.FirstOrDefaultAsync(m => m.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy phiên bản mô hình.");

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

    /* ---------------------------- UC-66 AUDIT --------------------------- */

    /// <summary>
    /// UC-66 — nhật ký audit, KEYSET pagination.
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

    private async Task<ModelVersionDto> GetModelDtoAsync(int id) =>
        await _repository.ModelVersions.AsNoTracking().Where(m => m.Id == id)
            .Select(m => new ModelVersionDto
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
                DiagnosisCount = _repository.AiDiagnoses.Count(d => d.ModelVersionId == m.Id)
            }).FirstAsync();
}
