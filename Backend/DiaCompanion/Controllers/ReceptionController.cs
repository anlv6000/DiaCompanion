using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Data;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>
/// LT-1..LT-9 — nghiệp vụ của LỄ TÂN (Receptionist).
///
/// Lễ tân là vai trò mới, đảm nhận khâu đầu quầy: tạo tài khoản/hồ sơ bệnh nhân,
/// mở lượt khám và gán bác sĩ đang trực. Việc gán bác sĩ dựa vào bảng ca trực
/// cố định theo tuần (DoctorShift): hôm nay là thứ mấy, ca nào, thì những bác sĩ
/// nào đang trực.
///
/// Ghi chú phân quyền: tạo bệnh nhân và tạo lượt khám vốn đã có ở
/// PatientsController / VisitsController nhưng đang giới hạn ở Roles.Staff
/// (Admin, Doctor, Nurse). Sau khi thêm lễ tân, cần mở các endpoint đó cho
/// Receptionist (đổi [Authorize(Roles = Roles.Staff)] thành
/// [Authorize(Roles = Roles.FrontDesk)] — xem RolesToAdd.cs). Controller này
/// KHÔNG lặp lại việc tạo bệnh nhân/lượt khám mà chỉ bổ sung phần còn thiếu:
/// tra cứu bác sĩ trực và quản lý ca trực.
/// </summary>
[Route("api/reception")]
public class ReceptionController : BaseApiController
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;
    private readonly IClinicClock _clock;

    public ReceptionController(AppDbContext db, ICurrentUser me, IClinicClock clock)
    { _db = db; _me = me; _clock = clock; }

    /* ==================================================================== */
    /*  BÁC SĨ ĐANG TRỰC — dữ liệu lễ tân chọn khi gán lượt khám            */
    /* ==================================================================== */

    /// <summary>
    /// LT-5 — danh sách bác sĩ trực theo ngày (mặc định hôm nay).
    /// Lễ tân dùng để chọn bác sĩ gán vào lượt khám mới.
    /// </summary>
    [HttpGet("on-duty")]
    [Authorize(Roles = Roles.FrontDesk)]
    public async Task<ActionResult<OnDutyResponse>> OnDuty([FromQuery] DateOnly? date, [FromQuery] byte? shift)
    {
        var day = date ?? _clock.LocalToday;
        var dow = (byte)day.DayOfWeek; // 0 = CN … 6 = T7

        var query = _db.Set<DoctorShift>()
            .Where(s => s.IsActive && s.DayOfWeek == dow);

        if (shift is 1 or 2)
            query = query.Where(s => (byte)s.Shift == shift);

        // Lấy ca trực + thông tin bác sĩ (chỉ bác sĩ còn hoạt động).
        var rows = await query
            .Join(_db.Users.Where(u => u.Role == UserRole.Doctor && u.IsActive),
                  s => s.DoctorId, u => u.Id,
                  (s, u) => new { s.Shift, u.Id, u.FullName, u.LicenseNo })
            .ToListAsync();

        // Đếm lượt khám đang mở hôm nay theo từng bác sĩ (để lễ tân cân tải).
        var todayStartUtc = _clock.ToUtc(day.ToDateTime(TimeOnly.MinValue));
        var todayEndUtc = _clock.ToUtc(day.ToDateTime(TimeOnly.MaxValue));
        var openCounts = await _db.Visits
            .Where(v => v.Status == VisitStatus.InProgress
                        && v.DoctorId != null
                        && v.VisitDate >= todayStartUtc && v.VisitDate <= todayEndUtc)
            .GroupBy(v => v.DoctorId!.Value)
            .Select(g => new { DoctorId = g.Key, Count = g.Count() })
            .ToListAsync();

        var doctors = rows
            .GroupBy(r => new { r.Id, r.FullName, r.LicenseNo })
            .Select(g =>
            {
                // Nếu lễ tân lọc theo ca cụ thể thì hiển thị đúng ca đó;
                // ngược lại lấy ca sớm hơn (Sáng trước Chiều) cho gọn.
                byte shownShift = (shift is 1 or 2) ? shift.Value : (byte)g.Min(x => x.Shift);
                return new OnDutyDoctorDto
                {
                    DoctorId = g.Key.Id,
                    DoctorName = g.Key.FullName,
                    LicenseNo = g.Key.LicenseNo,
                    Shift = shownShift,
                    ShiftLabel = ShiftLabel(shownShift),
                    OpenVisitCount = openCounts.FirstOrDefault(c => c.DoctorId == g.Key.Id)?.Count ?? 0,
                };
            })
            .OrderBy(d => d.OpenVisitCount)   // ai ít lượt mở hơn lên trước
            .ThenBy(d => d.DoctorName)
            .ToList();

        return Ok(new OnDutyResponse
        {
            Date = day,
            DayLabel = DayLabel(dow),
            CurrentShift = CurrentShift(),
            Doctors = doctors,
        });
    }

    /* ==================================================================== */
    /*  QUẢN LÝ CA TRỰC (LT-6..LT-9)                                        */
    /* ==================================================================== */

    /// <summary>LT-6 — xem toàn bộ lịch trực, lọc tùy chọn theo bác sĩ.</summary>
    [HttpGet("shifts")]
    [Authorize(Roles = Roles.FrontDeskOrAdmin)]
    public async Task<ActionResult<List<DoctorShiftDto>>> ListShifts([FromQuery] int? doctorId)
    {
        var q = _db.Set<DoctorShift>().AsQueryable();
        if (doctorId is int id) q = q.Where(s => s.DoctorId == id);

        var rows = await q
            .Join(_db.Users, s => s.DoctorId, u => u.Id, (s, u) => new { s, u })
            .OrderBy(x => x.s.DayOfWeek).ThenBy(x => x.s.Shift).ThenBy(x => x.u.FullName)
            .ToListAsync();

        var list = rows.Select(x => new DoctorShiftDto
        {
            Id = x.s.Id,
            DoctorId = x.s.DoctorId,
            DoctorName = x.u.FullName,
            LicenseNo = x.u.LicenseNo,
            DayOfWeek = x.s.DayOfWeek,
            DayLabel = DayLabel(x.s.DayOfWeek),
            Shift = (byte)x.s.Shift,
            ShiftLabel = ShiftLabel((byte)x.s.Shift),
            IsActive = x.s.IsActive,
            RowVersion = x.s.ToRowVersion()
        }).ToList();

        return Ok(list);
    }

    /// <summary>LT-7 — thêm một ca trực.</summary>
    [HttpPost("shifts")]
    [Authorize(Roles = Roles.FrontDeskOrAdmin)]
    public async Task<ActionResult<DoctorShiftDto>> CreateShift(CreateDoctorShiftRequest req)
    {
        await EnsureDoctorAsync(req.DoctorId);
        await EnsureNoDuplicateAsync(req.DoctorId, req.DayOfWeek, req.Shift);

        var shift = new DoctorShift
        {
            DoctorId = req.DoctorId,
            DayOfWeek = req.DayOfWeek,
            Shift = (ShiftType)req.Shift,
            CreatedBy = _me.RequireId(),
        };
        _db.Add(shift);
        await _db.SaveChangesAsync();

        return await ShiftDto(shift.Id);
    }

    /// <summary>
    /// LT-8 — thêm nhiều ca cùng lúc cho một bác sĩ (VD: Sáng T2, T4, T6).
    /// Bỏ qua những ngày đã có sẵn thay vì báo lỗi cả lô.
    /// </summary>
    [HttpPost("shifts/batch")]
    [Authorize(Roles = Roles.FrontDeskOrAdmin)]
    public async Task<ActionResult<List<DoctorShiftDto>>> CreateShiftsBatch(CreateDoctorShiftsBatchRequest req)
    {
        await EnsureDoctorAsync(req.DoctorId);

        var existing = await _db.Set<DoctorShift>()
            .Where(s => s.DoctorId == req.DoctorId && (byte)s.Shift == req.Shift)
            .Select(s => s.DayOfWeek)
            .ToListAsync();

        var toAdd = req.DaysOfWeek.Distinct()
            .Where(d => d <= 6 && !existing.Contains(d))
            .Select(d => new DoctorShift
            {
                DoctorId = req.DoctorId,
                DayOfWeek = d,
                Shift = (ShiftType)req.Shift,
                CreatedBy = _me.RequireId(),
            })
            .ToList();

        if (toAdd.Count > 0)
        {
            _db.AddRange(toAdd);
            await _db.SaveChangesAsync();
        }

        return await ListShifts(req.DoctorId);
    }

    /// <summary>LT-9 — bật/tắt một ca trực (nghỉ tạm) mà không xoá.</summary>
    [HttpPut("shifts/{id:int}/active")]
    [Authorize(Roles = Roles.FrontDeskOrAdmin)]
    public async Task<ActionResult<DoctorShiftDto>> SetShiftActive(
        int id,
        [FromQuery] bool active,
        [FromQuery] string rowVersion)
    {
        var shift = await _db.Set<DoctorShift>().FirstOrDefaultAsync(s => s.Id == id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy ca trực.");

        _db.ApplyOriginalRowVersion(shift, rowVersion);
        shift.IsActive = active;
        shift.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync();
        return await ShiftDto(shift.Id);
    }

    /// <summary>Xoá hẳn một ca trực (lịch nhập sai).</summary>
    [HttpDelete("shifts/{id:int}")]
    [Authorize(Roles = Roles.FrontDeskOrAdmin)]
    public async Task<IActionResult> DeleteShift(int id, [FromQuery] string rowVersion)
    {
        var shift = await _db.Set<DoctorShift>().FirstOrDefaultAsync(s => s.Id == id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy ca trực.");

        _db.ApplyOriginalRowVersion(shift, rowVersion);
        _db.Remove(shift);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ==================================================================== */
    /*  Helper riêng                                                        */
    /* ==================================================================== */

    private async Task EnsureDoctorAsync(int doctorId)
    {
        var ok = await _db.Users.AnyAsync(u => u.Id == doctorId && u.Role == UserRole.Doctor && u.IsActive);
        if (!ok) throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy bác sĩ đang hoạt động.");
    }

    private async Task EnsureNoDuplicateAsync(int doctorId, byte dow, byte shift)
    {
        var dup = await _db.Set<DoctorShift>()
            .AnyAsync(s => s.DoctorId == doctorId && s.DayOfWeek == dow && (byte)s.Shift == shift);
        if (dup) throw AppException.Conflict(Msg.SlotTaken, "Bác sĩ đã có ca trực này trong tuần.");
    }

    private async Task<ActionResult<DoctorShiftDto>> ShiftDto(int id)
    {
        var row = await _db.Set<DoctorShift>()
            .Where(s => s.Id == id)
            .Join(_db.Users, s => s.DoctorId, u => u.Id, (s, u) => new { s, u })
            .FirstAsync();

        return Ok(new DoctorShiftDto
        {
            Id = row.s.Id,
            DoctorId = row.s.DoctorId,
            DoctorName = row.u.FullName,
            LicenseNo = row.u.LicenseNo,
            DayOfWeek = row.s.DayOfWeek,
            DayLabel = DayLabel(row.s.DayOfWeek),
            Shift = (byte)row.s.Shift,
            ShiftLabel = ShiftLabel((byte)row.s.Shift),
            IsActive = row.s.IsActive,
            RowVersion = row.s.ToRowVersion()
        });
    }

    // Ca hiện tại suy theo giờ phòng khám: mốc 12:00 chia Sáng / Chiều.
    private byte? CurrentShift()
    {
        var h = _clock.LocalNow.Hour;
        if (h < 12) return 1;   // Sáng
        return 2;               // Chiều
    }

    private static string ShiftLabel(byte s) => s switch
    {
        1 => "Ca sáng",
        2 => "Ca chiều",
        _ => "—",
    };

    private static string DayLabel(byte dow) => dow switch
    {
        0 => "Chủ nhật",
        1 => "Thứ 2",
        2 => "Thứ 3",
        3 => "Thứ 4",
        4 => "Thứ 5",
        5 => "Thứ 6",
        6 => "Thứ 7",
        _ => "—",
    };
}
