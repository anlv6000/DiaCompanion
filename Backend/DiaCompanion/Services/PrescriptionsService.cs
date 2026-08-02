using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Dtos;

namespace DiaCompanion.Api.Services;

/// <summary>UC-36..40 — đơn thuốc và tuân thủ.</summary>
public class PrescriptionsService : BaseService, IPrescriptionsService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IVoidService _void;
    private readonly IAdherenceService _adherence;

    public PrescriptionsService(IRepository repository, ICurrentUser me, IAuditService audit,
                                   IVoidService voidSvc, IAdherenceService adherence)
    { _repository = repository; _me = me; _audit = audit; _void = voidSvc; _adherence = adherence; }

    /// <summary>UC-40 — lịch sử đơn thuốc.</summary>
    public async Task<ActionResult<PagedResult<PrescriptionDto>>> List(
        [FromQuery] int? patientId, [FromQuery] PageQuery page)
    {
        // Bệnh nhân chỉ xem được đơn của mình, dù truyền patientId nào
        var pid = _me.Role == UserRole.Patient ? RequireMyPatientId(_me) : patientId;
        if (pid is null) throw AppException.BadRequest(Msg.RequiredFields, "Cần chỉ định patientId.");
        EnsureCanAccessPatient(_me, pid.Value);

        var query = _repository.Prescriptions.AsNoTracking().Where(p => p.PatientId == pid);
        var total = await query.CountAsync();

        var rows = await query
            .Include(p => p.Doctor)
            .Include(p => p.Items)
            .AsSplitQuery()
            .OrderByDescending(p => p.IssuedAt)
            .Skip(page.Skip).Take(page.PageSize)
            .ToListAsync();

        var items = rows.Select(Map).ToList();

        return Ok(new PagedResult<PrescriptionDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }

    /// <summary>UC-37 — chi tiết đơn thuốc.</summary>
    public async Task<ActionResult<PrescriptionDto>> Get(int id)
    {
        var p = await _repository.Prescriptions.AsNoTracking()
            .Include(x => x.Doctor).Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy đơn thuốc.");

        EnsureCanAccessPatient(_me, p.PatientId);
        return Ok(Map(p));
    }

    /// <summary>UC-36 — kê đơn. Sinh luôn lịch nhắc uống thuốc cho ứng dụng bệnh nhân.</summary>
    public async Task<ActionResult<PrescriptionDto>> Create(CreatePrescriptionRequest req)
    {
        if (req.Items.Count == 0)
            throw AppException.BadRequest(Msg.EmptyPrescription, "Đơn thuốc phải có ít nhất một dòng thuốc.");

        if (!await _repository.Patients.AnyAsync(p => p.Id == req.PatientId))
            throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");


        var strategy = _repository.Database.CreateExecutionStrategy();

        var prescriptionId = await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _repository.Database.BeginTransactionAsync();

            try
            {
                var presc = new Prescription
                {
                    PatientId = req.PatientId,
                    VisitId = req.VisitId,
                    DoctorId = _me.RequireId(),
                    IssuedAt = DateTime.UtcNow,
                    Note = req.Note
                };
                _repository.Prescriptions.Add(presc);
                await _repository.SaveChangesAsync();

                var items = req.Items.Select(i => new PrescriptionItem
                {
                    PrescriptionId = presc.Id,
                    DrugName = i.DrugName.Trim(),
                    Dose = i.Dose.Trim(),
                    TimesPerDay = i.TimesPerDay,
                    DurationDays = i.DurationDays,
                    Instruction = i.Instruction?.Trim()
                }).ToList();

                _repository.PrescriptionItems.AddRange(items);
                await _repository.SaveChangesAsync();

                // NF-10: sinh lịch nhắc từ tần suất và số ngày
                // Sinh lịch nhắc uống thuốc.
                _adherence.GenerateSchedule(presc, items);

                await _audit.LogAsync(AuditAction.PrescriptionIssue, nameof(Prescription), presc.Id,
                    null, new { req.PatientId, itemCount = items.Count, drugs = items.Select(i => i.DrugName) });
                await _repository.SaveChangesAsync();
                await tx.CommitAsync();
                return presc.Id;
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
    /// UC-38 — sửa đơn thuốc.
    /// Sinh lại lịch nhắc cho các liều CHƯA tới hạn; liều đã xác nhận giữ nguyên
    /// vì đó là sự kiện đã xảy ra ngoài đời.
    /// </summary>
    public async Task<ActionResult<PrescriptionDto>> Update(
    int id,
    UpdatePrescriptionRequest req)
    {
        if (req.Items == null || req.Items.Count == 0)
        {
            throw AppException.BadRequest(
                Msg.EmptyPrescription,
                "Đơn thuốc phải có ít nhất một dòng thuốc.");
        }

        var strategy = _repository.Database.CreateExecutionStrategy();

        var prescriptionId = await strategy.ExecuteAsync(async () =>
        {
            await using var tx =
                await _repository.Database.BeginTransactionAsync();

            try
            {
                var presc = await _repository.Prescriptions
                    .Include(p => p.Items)
                    .FirstOrDefaultAsync(p => p.Id == id)
                    ?? throw AppException.NotFound(
                        Msg.LoadFailed,
                        "Không tìm thấy đơn thuốc.");

                _repository.ApplyOriginalRowVersion(presc, req.RowVersion);

                var before = presc.Items
                    .Select(i => new
                    {
                        i.Id,
                        i.DrugName,
                        i.Dose,
                        i.TimesPerDay,
                        i.DurationDays,
                        i.Instruction
                    })
                    .ToList();





                var missingIds = req.Items
    .Where(i => i.Id <= 0)
    .ToList();

                if (missingIds.Count > 0)
                {
                    throw AppException.BadRequest(
                        Msg.LoadFailed,
                        "Dữ liệu cập nhật thiếu ID của dòng thuốc. Frontend phải gửi PrescriptionItem.Id.");
                }
                /*
                 * Kiểm tra tất cả ID gửi lên có thật sự thuộc đơn thuốc này không.
                 */


                var oldItemIds = presc.Items
                    .Select(i => i.Id)
                    .ToHashSet();


                var invalidItemIds = req.Items
                    .Where(i => !oldItemIds.Contains(i.Id))
                    .Select(i => i.Id)
                    .ToList();

                if (invalidItemIds.Count > 0)
                {
                    throw AppException.BadRequest(
                        Msg.LoadFailed,
                        $"Có dòng thuốc không thuộc đơn này: {string.Join(", ", invalidItemIds)}.");
                }

                /*
                 * Hủy các lịch nhắc cũ đang Pending.
                 * Vì liều lượng, số lần uống hoặc số ngày có thể đã thay đổi.
                 */
                var pendingLogs = await _repository.MedicationLogs
                    .Where(m =>
                        oldItemIds.Contains(m.PrescriptionItemId) &&
                        m.Status == MedicationStatus.Pending)
                    .ToListAsync();

                foreach (var log in pendingLogs)
                {
                    log.Status = MedicationStatus.Cancelled;
                }

                /*
                 * Cập nhật trực tiếp các PrescriptionItem đang tồn tại.
                 * Không dùng Add hoặc AddRange.
                 */
                foreach (var requestItem in req.Items)
                {
                    var existingItem = presc.Items
                        .First(i => i.Id == requestItem.Id);

                    existingItem.DrugName = requestItem.DrugName.Trim();
                    existingItem.Dose = requestItem.Dose.Trim();
                    existingItem.TimesPerDay = requestItem.TimesPerDay;
                    existingItem.DurationDays = (short)requestItem.DurationDays;
                    existingItem.Instruction = requestItem.Instruction?.Trim();
                }

                presc.Note = req.Note?.Trim();
                // Chạm bản ghi cha để RowVer bảo vệ toàn bộ aggregate đơn thuốc.
                presc.UpdatedAt = DateTime.UtcNow;

                /*
                 * Các item này đã có ID sẵn vì đang tồn tại trong database.
                 * Không cần SaveChanges trước khi GenerateSchedule.
                 */
                var updatedItems = presc.Items
                    .Where(i => req.Items.Any(x => x.Id == i.Id))
                    .ToList();

                _adherence.GenerateSchedule(presc, updatedItems);

                await _audit.LogAsync(
                    "PRESCRIPTION_UPDATE",
                    nameof(Prescription),
                    presc.Id,
                    new
                    {
                        items = before
                    },
                    new
                    {
                        items = updatedItems.Select(i => new
                        {
                            i.Id,
                            i.DrugName,
                            i.Dose,
                            i.TimesPerDay,
                            i.DurationDays,
                            i.Instruction
                        }).ToList()
                    });

                await _repository.SaveChangesAsync();
                await tx.CommitAsync();

                return presc.Id;
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        });

        return Ok(await GetDtoAsync(prescriptionId));
    }

    /// <summary>UC-39 — thu hồi đơn thuốc.</summary>
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        await _void.VoidPrescriptionAsync(id, req.Reason, req.RowVersion);
        return Ok(new
        {
            message = "Đã thu hồi đơn thuốc. Lịch nhắc chưa tới hạn đã huỷ; " +
                      "các liều bệnh nhân đã xác nhận được giữ lại."
        });
    }

    /// <summary>UC-50 — tỉ lệ tuân thủ thuốc (bác sĩ và bệnh nhân cùng xem).</summary>
    public async Task<IActionResult> Adherence(int patientId, [FromQuery] int days = 30)
    {
        EnsureCanAccessPatient(_me, patientId);
        var s = await _adherence.GetAsync(patientId, days);
        return Ok(new
        {
            s.Total,
            s.Taken,
            s.Missed,
            s.Pending,
            s.Rate,
            days,
            note = "Tỉ lệ tính trên các liều đã tới hạn, không tính liều tương lai."
        });
    }

    private async Task<PrescriptionDto> GetDtoAsync(int id)
    {
        var p = await _repository.Prescriptions.AsNoTracking()
            .Include(x => x.Doctor).Include(x => x.Items)
            .FirstAsync(x => x.Id == id);
        return Map(p);
    }

    private static PrescriptionDto Map(Prescription p) => new()
    {
        Id = p.Id,
        PatientId = p.PatientId,
        VisitId = p.VisitId,
        DoctorName = p.Doctor?.FullName ?? "",
        IssuedAt = p.IssuedAt,
        Note = p.Note,
        RowVersion = p.ToRowVersion(),
        Items = p.Items.Select(i => new PrescriptionItemDto
        {
            Id = i.Id,
            DrugName = i.DrugName,
            Dose = i.Dose,
            TimesPerDay = i.TimesPerDay,
            DurationDays = i.DurationDays,
            Instruction = i.Instruction
        }).ToList()
    };
}
