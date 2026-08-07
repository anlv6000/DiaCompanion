using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;

namespace DiaCompanion.Api.Services;

public class ReceptionService : BaseService, IReceptionService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IClinicClock _clock;

    public ReceptionService(IRepository repository, ICurrentUser me, IClinicClock clock)
    { _repository = repository; _me = me; _clock = clock; }

    public async Task<ActionResult<OnDutyResponse>> OnDuty(DateOnly? date, byte? shift)
    {
        var day = date ?? _clock.LocalToday;
        var dow = (byte)day.DayOfWeek;
        var start = _clock.ToUtc(day.ToDateTime(TimeOnly.MinValue));
        var end = _clock.ToUtc(day.ToDateTime(TimeOnly.MaxValue));
        var rows = await _repository.GetOnDutyDoctorsAsync(dow, shift, start, end);

        var doctors = rows
            .GroupBy(r => new { r.DoctorId, r.DoctorName, r.LicenseNo, r.OpenVisitCount })
            .Select(g =>
            {
                var shown = shift is 1 or 2 ? shift.Value : g.Min(x => x.Shift);
                return new OnDutyDoctorDto
                {
                    DoctorId = g.Key.DoctorId,
                    DoctorName = g.Key.DoctorName,
                    LicenseNo = g.Key.LicenseNo,
                    Shift = shown,
                    ShiftLabel = ShiftLabel(shown),
                    OpenVisitCount = g.Key.OpenVisitCount
                };
            })
            .OrderBy(x => x.OpenVisitCount).ThenBy(x => x.DoctorName).ToList();

        return Ok(new OnDutyResponse
        {
            Date = day,
            DayLabel = DayLabel(dow),
            CurrentShift = CurrentShift(),
            Doctors = doctors
        });
    }

    public async Task<ActionResult<List<DoctorShiftDto>>> ListShifts(int? doctorId)
    {
        var rows = await _repository.GetDoctorShiftsAsync(doctorId);
        return Ok(rows.Select(MapShift).ToList());
    }

    public async Task<ActionResult<DoctorShiftDto>> CreateShift(CreateDoctorShiftRequest req)
    {
        await EnsureDoctorAsync(req.DoctorId);
        await EnsureNoDuplicateAsync(req.DoctorId, req.DayOfWeek, req.Shift);

        var shift = new DoctorShift
        {
            DoctorId = req.DoctorId,
            DayOfWeek = req.DayOfWeek,
            Shift = (ShiftType)req.Shift,
            CreatedBy = _me.RequireId()
        };
        _repository.Add(shift);
        await _repository.CommitAsync();
        return Ok(await GetShiftDtoAsync(shift.Id));
    }

    public async Task<ActionResult<List<DoctorShiftDto>>> CreateShiftsBatch(CreateDoctorShiftsBatchRequest req)
    {
        await EnsureDoctorAsync(req.DoctorId);
        var existing = await _repository.GetExistingShiftDaysAsync(req.DoctorId, req.Shift);
        var existingSet = existing.ToHashSet();
        var rows = req.DaysOfWeek.Distinct()
            .Where(d => d <= 6 && !existingSet.Contains(d))
            .Select(d => new DoctorShift
            {
                DoctorId = req.DoctorId,
                DayOfWeek = d,
                Shift = (ShiftType)req.Shift,
                CreatedBy = _me.RequireId()
            }).ToList();
        if (rows.Count > 0)
        {
            _repository.AddRange(rows);
            await _repository.CommitAsync();
        }
        return await ListShifts(req.DoctorId);
    }

    public async Task<ActionResult<DoctorShiftDto>> SetShiftActive(int id, bool active, string rowVersion)
    {
        var shift = await _repository.GetDoctorShiftForUpdateAsync(id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy ca trực.");
        _repository.ApplyOriginalRowVersion(shift, rowVersion);
        shift.IsActive = active;
        shift.UpdatedAt = _clock.UtcNow;
        await _repository.CommitAsync();
        return Ok(await GetShiftDtoAsync(id));
    }

    public async Task<IActionResult> DeleteShift(int id, string rowVersion)
    {
        var shift = await _repository.GetDoctorShiftForUpdateAsync(id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy ca trực.");
        _repository.ApplyOriginalRowVersion(shift, rowVersion);
        _repository.Remove(shift);
        await _repository.CommitAsync();
        return NoContent();
    }

    private async Task EnsureDoctorAsync(int doctorId)
    {
        if (!await _repository.IsActiveUserInRoleAsync(doctorId, Roles.Doctor))
            throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy bác sĩ đang hoạt động.");
    }

    private async Task EnsureNoDuplicateAsync(int doctorId, byte dow, byte shift)
    {
        if (await _repository.DoctorShiftExistsAsync(doctorId, dow, shift))
            throw AppException.Conflict(Msg.SlotTaken, "Bác sĩ đã có ca trực này trong tuần.");
    }

    private async Task<DoctorShiftDto> GetShiftDtoAsync(int id)
    {
        var row = await _repository.GetDoctorShiftRowAsync(id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy ca trực.");
        return MapShift(row);
    }

    private DoctorShiftDto MapShift(DoctorShiftRow row) => new()
    {
        Id = row.Shift.Id,
        DoctorId = row.Shift.DoctorId,
        DoctorName = row.Doctor.FullName,
        LicenseNo = row.Doctor.LicenseNo,
        DayOfWeek = row.Shift.DayOfWeek,
        DayLabel = DayLabel(row.Shift.DayOfWeek),
        Shift = (byte)row.Shift.Shift,
        ShiftLabel = ShiftLabel((byte)row.Shift.Shift),
        IsActive = row.Shift.IsActive,
        RowVersion = row.Shift.ToRowVersion()
    };

    private byte? CurrentShift() => _clock.LocalNow.Hour < 12 ? (byte)1 : (byte)2;
    private static string ShiftLabel(byte s) => s switch { 1 => "Ca sáng", 2 => "Ca chiều", _ => "—" };
    private static string DayLabel(byte dow) => dow switch
    {
        0 => "Chủ nhật", 1 => "Thứ 2", 2 => "Thứ 3", 3 => "Thứ 4",
        4 => "Thứ 5", 5 => "Thứ 6", 6 => "Thứ 7", _ => "—"
    };
}
