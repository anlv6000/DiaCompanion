using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

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

        var items = await query.OrderByDescending(p => p.IssuedAt)
            .Skip(page.Skip).Take(page.PageSize)
            .Select(p => new PrescriptionDto
            {
                Id = p.Id,
                PatientId = p.PatientId,
                VisitId = p.VisitId,
                DoctorName = p.Doctor!.FullName,
                IssuedAt = p.IssuedAt,
                Note = p.Note,
                Items = p.Items.Select(i => new PrescriptionItemDto
                {
                    Id = i.Id,
                    DrugName = i.DrugName,
                    Dose = i.Dose,
                    TimesPerDay = i.TimesPerDay,
                    DurationDays = i.DurationDays,
                    Instruction = i.Instruction
                }).ToList()
            }).ToListAsync();

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
    public async Task<ActionResult<PrescriptionDto>> Update(int id, CreatePrescriptionRequest req)
    {
        if (req.Items.Count == 0)
            throw AppException.BadRequest(Msg.EmptyPrescription, "Đơn thuốc phải có ít nhất một dòng thuốc.");

        var presc = await _repository.Prescriptions.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy đơn thuốc.");

        await using var tx = await _repository.Database.BeginTransactionAsync();

        var before = presc.Items.Select(i => new { i.DrugName, i.Dose, i.TimesPerDay, i.DurationDays }).ToList();
        var oldItemIds = presc.Items.Select(i => i.Id).ToList();

        // Huỷ liều chưa tới hạn của đơn cũ
        var pending = await _repository.MedicationLogs
            .Where(m => oldItemIds.Contains(m.PrescriptionItemId) && m.Status == MedicationStatus.Pending)
            .ToListAsync();
        foreach (var m in pending) m.Status = MedicationStatus.Cancelled;

        // Dòng thuốc cũ KHÔNG xoá cứng: MedicationLogs đã ghi nhận vẫn tham chiếu
        // tới chúng (QT-6). Thêm dòng mới, đánh dấu dòng cũ hết hiệu lực bằng
        // việc huỷ lịch nhắc ở trên.
        var newItems = req.Items.Select(i => new PrescriptionItem
        {
            PrescriptionId = presc.Id,
            DrugName = i.DrugName.Trim(),
            Dose = i.Dose.Trim(),
            TimesPerDay = i.TimesPerDay,
            DurationDays = i.DurationDays,
            Instruction = i.Instruction
        }).ToList();

        _repository.PrescriptionItems.AddRange(newItems);
        presc.Note = req.Note;
        await _repository.SaveChangesAsync();

        _adherence.GenerateSchedule(presc, newItems);

        await _audit.LogAsync("PRESCRIPTION_UPDATE", nameof(Prescription), presc.Id,
            new { items = before }, new { items = req.Items });
        await _repository.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(await GetDtoAsync(presc.Id));
    }

    /// <summary>UC-39 — thu hồi đơn thuốc.</summary>
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        await _void.VoidPrescriptionAsync(id, req.Reason);
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
