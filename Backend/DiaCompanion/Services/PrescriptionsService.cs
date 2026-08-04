using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DiaCompanion.Api.Services;

/// <summary>UC-36..45 — đơn thuốc, lịch dùng thuốc và tuân thủ.</summary>
public class PrescriptionsService : BaseService, IPrescriptionsService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IVoidService _void;
    private readonly IAdherenceService _adherence;
    private readonly IClinicClock _clock;

    public PrescriptionsService(
        IRepository repository,
        ICurrentUser me,
        IAuditService audit,
        IVoidService voidSvc,
        IAdherenceService adherence,
        IClinicClock clock)
    {
        _repository = repository;
        _me = me;
        _audit = audit;
        _void = voidSvc;
        _adherence = adherence;
        _clock = clock;
    }

    /// <summary>UC-40 — lịch sử đơn thuốc có tìm kiếm, lọc, sắp xếp và phân trang.</summary>
    public async Task<ActionResult<PagedResult<PrescriptionDto>>> List(
        int? patientId,
        string? q,
        DateOnly? from,
        DateOnly? to,
        bool? voided,
        PageQuery page)
    {
        var pid = _me.Role == UserRole.Patient ? RequireMyPatientId(_me) : patientId;
        if (pid is null)
            throw AppException.BadRequest(Msg.RequiredFields, "Cần chỉ định patientId.");

        EnsureCanAccessPatient(_me, pid.Value);

        var query = _repository.Prescriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.PatientId == pid.Value);

        if (voided is bool isVoided)
            query = query.Where(p => p.IsVoided == isVoided);

        if (from is DateOnly fromDate)
        {
            var fromUtc = _clock.ToUtc(fromDate.ToDateTime(TimeOnly.MinValue));
            query = query.Where(p => p.IssuedAt >= fromUtc);
        }

        if (to is DateOnly toDate)
        {
            var toExclusiveUtc = _clock.ToUtc(toDate.AddDays(1).ToDateTime(TimeOnly.MinValue));
            query = query.Where(p => p.IssuedAt < toExclusiveUtc);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var keyword = q.Trim();
            query = query.Where(p =>
                (p.Note != null && EF.Functions.Like(p.Note, $"%{keyword}%")) ||
                p.Items.Any(i => EF.Functions.Like(i.DrugName, $"%{keyword}%")));
        }

        var total = await query.CountAsync();

        query = page.Sort?.Trim().ToLowerInvariant() switch
        {
            "doctor" => page.Desc
                ? query.OrderByDescending(p => p.Doctor!.FullName).ThenByDescending(p => p.Id)
                : query.OrderBy(p => p.Doctor!.FullName).ThenBy(p => p.Id),
            "status" => page.Desc
                ? query.OrderByDescending(p => p.IsVoided).ThenByDescending(p => p.IssuedAt)
                : query.OrderBy(p => p.IsVoided).ThenByDescending(p => p.IssuedAt),
            _ => page.Desc
                ? query.OrderBy(p => p.IssuedAt).ThenBy(p => p.Id)
                : query.OrderByDescending(p => p.IssuedAt).ThenByDescending(p => p.Id)
        };

        var rows = await query
            .Include(p => p.Doctor)
            .Include(p => p.Items)
            .AsSplitQuery()
            .Skip(page.Skip)
            .Take(page.PageSize)
            .ToListAsync();

        var stats = await LoadMedicationStatsAsync(rows.Select(p => p.Id));
        var items = rows.Select(p => Map(p, stats.GetValueOrDefault(p.Id))).ToList();

        return Ok(new PagedResult<PrescriptionDto>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = total
        });
    }

    /// <summary>UC-37 — chi tiết đơn thuốc, kể cả đơn đã void để giữ lịch sử lâm sàng.</summary>
    public async Task<ActionResult<PrescriptionDto>> Get(int id)
    {
        var p = await _repository.Prescriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(x => x.Doctor)
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy đơn thuốc.");

        EnsureCanAccessPatient(_me, p.PatientId);
        var stats = await LoadMedicationStatsAsync(new[] { p.Id });
        return Ok(Map(p, stats.GetValueOrDefault(p.Id)));
    }

    /// <summary>UC-36 — chỉ bác sĩ được phân công mới được kê đơn cho đúng bệnh nhân của lượt khám.</summary>
    public async Task<ActionResult<PrescriptionDto>> Create(CreatePrescriptionRequest req)
    {
        if (req.Items.Count == 0)
            throw AppException.BadRequest(Msg.EmptyPrescription, "Đơn thuốc phải có ít nhất một dòng thuốc.");

        if (req.VisitId is not int visitId)
            throw AppException.BadRequest(Msg.RequiredFields, "Đơn thuốc phải gắn với một lượt khám.");

        var doctorId = _me.RequireId();
        var visit = await _repository.Visits.FirstOrDefaultAsync(v => v.Id == visitId)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");

        EnsureAssignedDoctor(visit, doctorId);

        if (visit.PatientId != req.PatientId)
            throw AppException.BadRequest(Msg.InvalidData, "Bệnh nhân không thuộc lượt khám đã chọn.");

        if (visit.Status != VisitStatus.InProgress)
            throw AppException.BadRequest(Msg.ApptImmutable, "Không thể tạo đơn mới sau khi lượt khám đã hoàn tất.");

        var strategy = _repository.Database.CreateExecutionStrategy();
        var prescriptionId = await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _repository.Database.BeginTransactionAsync();
            try
            {
                var prescription = new Prescription
                {
                    PatientId = req.PatientId,
                    VisitId = visit.Id,
                    DoctorId = doctorId,
                    IssuedAt = _clock.UtcNow,
                    Note = req.Note?.Trim()
                };

                _repository.Prescriptions.Add(prescription);
                await _repository.SaveChangesAsync();

                var items = req.Items.Select(i => new PrescriptionItem
                {
                    PrescriptionId = prescription.Id,
                    DrugName = i.DrugName.Trim(),
                    Dose = i.Dose.Trim(),
                    TimesPerDay = i.TimesPerDay,
                    DurationDays = i.DurationDays,
                    Instruction = i.Instruction?.Trim(),
                    IsActive = true
                }).ToList();

                _repository.PrescriptionItems.AddRange(items);
                await _repository.SaveChangesAsync();

                _adherence.GenerateSchedule(prescription, items);
                await _audit.LogAsync(
                    AuditAction.PrescriptionIssue,
                    nameof(Prescription),
                    prescription.Id,
                    null,
                    new
                    {
                        prescription.PatientId,
                        prescription.VisitId,
                        itemCount = items.Count,
                        drugs = items.Select(i => i.DrugName)
                    });

                await _repository.SaveChangesAsync();
                await tx.CommitAsync();
                return prescription.Id;
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        });

        return Ok(await GetDtoAsync(prescriptionId));
    }

    /// <summary>
    /// UC-38 — thay thế tập dòng thuốc đang hiệu lực. Dòng bị bỏ khỏi request được ngừng hiệu lực,
    /// lịch Pending cũ bị hủy, lịch sử Taken/Missed/Skipped được giữ nguyên.
    /// </summary>
    public async Task<ActionResult<PrescriptionDto>> Update(int id, UpdatePrescriptionRequest req)
    {
        if (req.Items is null || req.Items.Count == 0)
            throw AppException.BadRequest(Msg.EmptyPrescription, "Đơn thuốc phải có ít nhất một dòng thuốc.");

        if (req.Items.Where(i => i.Id > 0).GroupBy(i => i.Id).Any(g => g.Count() > 1))
            throw AppException.BadRequest(Msg.InvalidData, "Danh sách cập nhật chứa ID dòng thuốc bị lặp.");

        var strategy = _repository.Database.CreateExecutionStrategy();
        var prescriptionId = await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _repository.Database.BeginTransactionAsync();
            try
            {
                var prescription = await _repository.Prescriptions
                    .Include(p => p.Items)
                    .FirstOrDefaultAsync(p => p.Id == id)
                    ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy đơn thuốc.");

                var doctorId = _me.RequireId();
                if (prescription.VisitId is not int visitId)
                    throw AppException.Conflict(Msg.InvalidData, "Đơn thuốc chưa được liên kết với lượt khám.");

                var visit = await _repository.Visits.FirstOrDefaultAsync(v => v.Id == visitId)
                    ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám liên quan.");

                EnsureAssignedDoctor(visit, doctorId);
                if (visit.PatientId != prescription.PatientId)
                    throw AppException.Conflict(Msg.InvalidData, "Đơn thuốc không khớp bệnh nhân của lượt khám.");

                _repository.ApplyOriginalRowVersion(prescription, req.RowVersion);

                var before = prescription.Items.Select(i => new
                {
                    i.Id,
                    i.DrugName,
                    i.Dose,
                    i.TimesPerDay,
                    i.DurationDays,
                    i.Instruction,
                    i.IsActive
                }).ToList();

                var oldItemsById = prescription.Items.ToDictionary(i => i.Id);
                var requestedExistingIds = req.Items.Where(i => i.Id > 0).Select(i => i.Id).ToHashSet();
                var invalidIds = requestedExistingIds.Where(itemId => !oldItemsById.ContainsKey(itemId)).ToList();
                if (invalidIds.Count > 0)
                    throw AppException.BadRequest(
                        Msg.InvalidData,
                        $"Có dòng thuốc không thuộc đơn này: {string.Join(", ", invalidIds)}.");

                var oldItemIds = oldItemsById.Keys.ToList();
                var pendingLogs = await _repository.MedicationLogs
                    .Where(m => oldItemIds.Contains(m.PrescriptionItemId) && m.Status == MedicationStatus.Pending)
                    .ToListAsync();

                foreach (var log in pendingLogs)
                    log.Status = MedicationStatus.Cancelled;

                foreach (var oldItem in prescription.Items)
                    oldItem.IsActive = requestedExistingIds.Contains(oldItem.Id);

                var activeItems = new List<PrescriptionItem>();
                foreach (var requestItem in req.Items)
                {
                    PrescriptionItem item;
                    if (requestItem.Id > 0)
                    {
                        item = oldItemsById[requestItem.Id];
                    }
                    else
                    {
                        item = new PrescriptionItem
                        {
                            PrescriptionId = prescription.Id
                        };
                        _repository.PrescriptionItems.Add(item);
                    }

                    item.DrugName = requestItem.DrugName.Trim();
                    item.Dose = requestItem.Dose.Trim();
                    item.TimesPerDay = requestItem.TimesPerDay;
                    item.DurationDays = checked((short)requestItem.DurationDays);
                    item.Instruction = requestItem.Instruction?.Trim();
                    item.IsActive = true;
                    activeItems.Add(item);
                }

                prescription.Note = req.Note?.Trim();
                prescription.UpdatedAt = _clock.UtcNow;

                // Save lần 1 vừa kiểm tra rowVersion của aggregate, vừa cấp ID cho item mới.
                await _repository.SaveChangesAsync();

                _adherence.GenerateSchedule(prescription, activeItems);
                await _audit.LogAsync(
                    AuditAction.PrescriptionUpdate,
                    nameof(Prescription),
                    prescription.Id,
                    new { items = before },
                    new
                    {
                        items = activeItems.Select(i => new
                        {
                            i.Id,
                            i.DrugName,
                            i.Dose,
                            i.TimesPerDay,
                            i.DurationDays,
                            i.Instruction,
                            i.IsActive
                        }),
                        cancelledPendingLogs = pendingLogs.Count
                    });

                await _repository.SaveChangesAsync();
                await tx.CommitAsync();
                return prescription.Id;
            }
            catch (DbUpdateConcurrencyException)
            {
                await tx.RollbackAsync();
                throw AppException.Conflict(
                    Msg.StaleVersion,
                    "Đơn thuốc đã được người khác cập nhật. Vui lòng tải lại dữ liệu trước khi thử lại.");
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        });

        return Ok(await GetDtoAsync(prescriptionId));
    }

    /// <summary>UC-39 — void đơn thuốc và trả token mới.</summary>
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        var rowVersion = await _void.VoidPrescriptionAsync(id, req.Reason, req.RowVersion);
        return Ok(new
        {
            message = "Đã thu hồi đơn thuốc. Lịch nhắc chưa tới hạn đã hủy; các liều đã xử lý được giữ lại.",
            rowVersion
        });
    }

    /// <summary>UC-45 — tỉ lệ tuân thủ, có thể lọc theo đơn hoặc khoảng ngày.</summary>
    public async Task<IActionResult> Adherence(
        int patientId,
        int days = 30,
        int? prescriptionId = null,
        DateOnly? from = null,
        DateOnly? to = null)
    {
        EnsureCanAccessPatient(_me, patientId);
        var summary = await _adherence.GetAsync(patientId, days, prescriptionId, from, to);
        return Ok(new
        {
            summary.Total,
            summary.Taken,
            summary.Missed,
            summary.Skipped,
            summary.Pending,
            summary.Rate,
            days,
            prescriptionId,
            from,
            to,
            note = "Tỉ lệ tính trên các liều đã tới hạn; Skipped và Missed đều không được tính là tuân thủ."
        });
    }

    private async Task<PrescriptionDto> GetDtoAsync(int id)
    {
        var prescription = await _repository.Prescriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(x => x.Doctor)
            .Include(x => x.Items)
            .FirstAsync(x => x.Id == id);

        var stats = await LoadMedicationStatsAsync(new[] { id });
        return Map(prescription, stats.GetValueOrDefault(id));
    }

    private async Task<Dictionary<int, MedicationStats>> LoadMedicationStatsAsync(IEnumerable<int> prescriptionIds)
    {
        var ids = prescriptionIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<int, MedicationStats>();

        var rows = await _repository.MedicationLogs.AsNoTracking()
            .Where(l => ids.Contains(l.PrescriptionItem!.PrescriptionId) && l.Status != MedicationStatus.Cancelled)
            .GroupBy(l => l.PrescriptionItem!.PrescriptionId)
            .Select(g => new
            {
                PrescriptionId = g.Key,
                Total = g.Count(),
                Taken = g.Count(x => x.Status == MedicationStatus.Taken),
                Missed = g.Count(x => x.Status == MedicationStatus.Missed),
                Skipped = g.Count(x => x.Status == MedicationStatus.Skipped)
            })
            .ToListAsync();

        return rows.ToDictionary(
            x => x.PrescriptionId,
            x => new MedicationStats(x.Total, x.Taken, x.Missed, x.Skipped));
    }

    private static PrescriptionDto Map(Prescription p, MedicationStats? stats)
    {
        stats ??= new MedicationStats(0, 0, 0, 0);
        var due = stats.Taken + stats.Missed + stats.Skipped;
        var rate = due == 0 ? 0m : Math.Round(stats.Taken * 100m / due, 1);

        return new PrescriptionDto
        {
            Id = p.Id,
            PatientId = p.PatientId,
            VisitId = p.VisitId,
            DoctorId = p.DoctorId,
            DoctorName = p.Doctor?.FullName ?? "",
            IssuedAt = p.IssuedAt,
            UpdatedAt = p.UpdatedAt,
            Note = p.Note,
            IsVoided = p.IsVoided,
            VoidReason = p.VoidReason,
            VoidedAt = p.VoidedAt,
            ScheduledDoses = stats.Total,
            TakenDoses = stats.Taken,
            MissedDoses = stats.Missed,
            SkippedDoses = stats.Skipped,
            AdherenceRate = rate,
            RowVersion = p.ToRowVersion(),
            Items = p.Items
                .OrderByDescending(i => i.IsActive)
                .ThenBy(i => i.Id)
                .Select(i => new PrescriptionItemDto
                {
                    Id = i.Id,
                    DrugName = i.DrugName,
                    Dose = i.Dose,
                    TimesPerDay = i.TimesPerDay,
                    DurationDays = i.DurationDays,
                    Instruction = i.Instruction,
                    IsActive = i.IsActive
                }).ToList()
        };
    }

    private static void EnsureAssignedDoctor(Visit visit, int doctorId)
    {
        if (visit.DoctorId != doctorId)
            throw AppException.Forbidden(
                Msg.Forbidden,
                "Bác sĩ chỉ được thao tác đơn thuốc của lượt khám do mình phụ trách.");
    }

    private sealed record MedicationStats(int Total, int Taken, int Missed, int Skipped);
}
