using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

public sealed partial class EfRepository
{
    public async Task<IReadOnlyList<OnDutyDoctorRow>> GetOnDutyDoctorsAsync(
        byte dayOfWeek, byte? shift, DateTime dayStartUtc, DateTime dayEndUtc, CancellationToken ct = default)
    {
        var shifts = _db.DoctorShifts.AsNoTracking()
            .Where(s => s.IsActive && s.DayOfWeek == dayOfWeek);

        if (shift is 1 or 2) shifts = shifts.Where(s => (byte)s.Shift == shift);

        var rows = await shifts
            .Join(
                _db.Users.AsNoTracking().Where(u =>
                    u.UserRoles.Any(ur => ur.IsActive && ur.Role.IsActive && ur.Role.Name == Roles.Doctor)),
                s => s.DoctorId,
                u => u.Id,
                (s, u) => new { s.Shift, u.Id, u.FullName, u.LicenseNo })
            .ToListAsync(ct);

        var counts = await _db.Visits.AsNoTracking()
            .Where(v => v.Status == VisitStatus.InProgress && v.DoctorId != null
                        && v.VisitDate >= dayStartUtc && v.VisitDate < dayEndUtc)
            .GroupBy(v => v.DoctorId!.Value)
            .Select(g => new { DoctorId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.DoctorId, x => x.Count, ct);

        return rows.Select(r => new OnDutyDoctorRow(
            (byte)r.Shift, r.Id, r.FullName, r.LicenseNo,
            counts.TryGetValue(r.Id, out var count) ? count : 0)).ToList();
    }

    public async Task<IReadOnlyList<DoctorShiftRow>> GetDoctorShiftsAsync(int? doctorId, CancellationToken ct = default)
    {
        var query = _db.DoctorShifts.AsNoTracking().AsQueryable();
        if (doctorId is int id) query = query.Where(s => s.DoctorId == id);

        var rows = await query
            .Join(_db.Users.AsNoTracking(), s => s.DoctorId, u => u.Id, (s, u) => new { s, u })
            .OrderBy(x => x.s.DayOfWeek).ThenBy(x => x.s.Shift).ThenBy(x => x.u.FullName)
            .ToListAsync(ct);
        return rows.Select(x => new DoctorShiftRow(x.s, x.u)).ToList();
    }

    public async Task<DoctorShiftRow?> GetDoctorShiftRowAsync(int id, CancellationToken ct = default)
    {
        var row = await _db.DoctorShifts.AsNoTracking()
            .Where(s => s.Id == id)
            .Join(_db.Users.AsNoTracking(), s => s.DoctorId, u => u.Id, (s, u) => new { s, u })
            .FirstOrDefaultAsync(ct);
        return row is null ? null : new DoctorShiftRow(row.s, row.u);
    }

    public Task<DoctorShift?> GetDoctorShiftForUpdateAsync(int id, CancellationToken ct = default) =>
        _db.DoctorShifts.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<IReadOnlyList<byte>> GetExistingShiftDaysAsync(int doctorId, byte shift, CancellationToken ct = default) =>
        await _db.DoctorShifts.AsNoTracking()
            .Where(s => s.DoctorId == doctorId && (byte)s.Shift == shift)
            .Select(s => s.DayOfWeek)
            .ToListAsync(ct);

    public Task<bool> DoctorShiftExistsAsync(int doctorId, byte dayOfWeek, byte shift, CancellationToken ct = default) =>
        _db.DoctorShifts.AsNoTracking()
            .AnyAsync(s => s.DoctorId == doctorId && s.DayOfWeek == dayOfWeek && (byte)s.Shift == shift, ct);
}
