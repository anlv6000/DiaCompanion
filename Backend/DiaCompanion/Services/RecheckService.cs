using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>
/// UC-41, UC-42 — nhắc tái tầm soát.
///
/// Thay cho chức năng đặt lịch theo khung giờ đã bỏ. Ngày tái khám được TÍNH
/// từ lượt khám hoàn tất gần nhất (ClosedAt + RecheckMonths, BR-19), không lưu
/// trong bảng riêng và không có trạng thái đặt/hủy/đổi.
///
/// Bệnh nhân đến khám trực tiếp trong giờ làm việc.
/// </summary>
public class RecheckService : BaseService, IRecheckService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IClinicClock _clock;

    public RecheckService(IRepository repository, ICurrentUser me, IClinicClock clock)
    { _repository = repository; _me = me; _clock = clock; }

    /// <summary>UC-41 — bệnh nhân xem lần tái khám tiếp theo của mình.</summary>
    public async Task<ActionResult<RecheckDto>> Mine()
    {
        var pid = RequireMyPatientId(_me);
        var item = await BuildAsync(pid);

        if (item is null)
            return Ok(new
            {
                hasRecheck = false,
                message = "Bạn chưa có lịch tái tầm soát. Lịch sẽ được xác định sau lần khám tiếp theo."
            });

        return Ok(item);
    }

    /// <summary>Xem ngày tái khám của một bệnh nhân cụ thể (phía phòng khám).</summary>
    public async Task<ActionResult<RecheckDto>> ForPatient(int patientId)
    {
        var item = await BuildAsync(patientId);
        if (item is null)
            throw AppException.NotFound(Msg.LoadFailed,
                "Bệnh nhân chưa có lượt khám hoàn tất nào để tính ngày tái tầm soát.");
        return Ok(item);
    }

    /// <summary>
    /// UC-42 — danh sách bệnh nhân đến hạn tái tầm soát, để phòng khám gọi nhắc.
    ///
    /// Toàn bộ tính từ dữ liệu lượt khám, không có bảng lịch hẹn. Bệnh nhân
    /// được coi là chưa quay lại khi chưa có lượt khám nào mới hơn lượt đã đóng.
    /// </summary>
    public async Task<ActionResult<PagedResult<RecheckDto>>> Due(
        [FromQuery] bool overdueOnly = false,
        [FromQuery] int withinDays = 30,
        [FromQuery] PageQuery? page = null)
    {
        page ??= new PageQuery();
        var today = _clock.LocalToday;

        // Lượt khám hoàn tất gần nhất của mỗi bệnh nhân, và chưa có lượt nào mới hơn
        var lastVisits = _repository.Visits.AsNoTracking()
            .Where(v => v.Status == VisitStatus.Completed
                        && v.ClosedAt != null
                        && v.RecheckMonths != null)
            .GroupBy(v => v.PatientId)
            .Select(g => new { PatientId = g.Key, ClosedAt = g.Max(v => v.ClosedAt!.Value) });

        var query =
            from lv in lastVisits
            join v in _repository.Visits.AsNoTracking()
                on new { lv.PatientId, ClosedAt = (DateTime?)lv.ClosedAt }
                equals new { v.PatientId, v.ClosedAt }
            join p in _repository.Patients.AsNoTracking() on lv.PatientId equals p.Id
            select new
            {
                p.Id,
                p.Code,
                p.FullName,
                p.Phone,
                LastVisitId = v.Id,
                ClosedAt = v.ClosedAt!.Value,
                RecheckMonths = v.RecheckMonths!.Value,
                Referral = v.Referral
            };

        var rows = await query.ToListAsync();

        // Tính ngày đến hạn trong bộ nhớ: DATEADD theo tháng không dịch gọn sang
        // LINQ, và số bệnh nhân có lượt khám hoàn tất ở quy mô một phòng khám
        // vẫn nhỏ so với chi phí truy vấn.
        var computed = rows.Select(r =>
        {
            var due = DateOnly.FromDateTime(r.ClosedAt.AddMonths(r.RecheckMonths));
            var past = today.DayNumber - due.DayNumber;
            return new
            {
                Row = r,
                Due = due,
                PastDue = past
            };
        }).ToList();

        // Đã có lượt khám mới hơn nghĩa là bệnh nhân đã quay lại — loại khỏi danh sách
        var patientIds = computed.Select(c => c.Row.Id).ToList();
        var returned = await _repository.Visits.AsNoTracking()
            .Where(v => patientIds.Contains(v.PatientId))
            .GroupBy(v => v.PatientId)
            .Select(g => new { PatientId = g.Key, LatestVisit = g.Max(v => v.VisitDate) })
            .ToDictionaryAsync(x => x.PatientId, x => x.LatestVisit);

        computed = computed
            .Where(c => !returned.TryGetValue(c.Row.Id, out var latest) || latest <= c.Row.ClosedAt)
            .ToList();

        computed = overdueOnly
            ? computed.Where(c => c.PastDue > 0).ToList()
            : computed.Where(c => c.PastDue >= -withinDays).ToList();

        // Quá hạn lâu nhất lên đầu — đó là người có nguy cơ mất dấu cao nhất
        computed = computed.OrderByDescending(c => c.PastDue).ToList();

        var total = computed.Count;
        var pageRows = computed.Skip(page.Skip).Take(page.PageSize).ToList();

        var ids = pageRows.Select(c => c.Row.LastVisitId).ToList();
        var grades = await _repository.DiagnosisReviews.AsNoTracking()
            .Where(r => ids.Contains(r.AiDiagnosis!.FundusImage!.VisitId!.Value))
            .GroupBy(r => r.AiDiagnosis!.FundusImage!.VisitId!.Value)
            .Select(g => new { VisitId = g.Key, MaxGrade = (byte)g.Max(x => (byte)x.FinalGrade) })
            .ToDictionaryAsync(x => x.VisitId, x => x.MaxGrade);

        var items = pageRows.Select(c => new RecheckDto
        {
            PatientId = c.Row.Id,
            PatientCode = c.Row.Code,
            PatientName = c.Row.FullName,
            PatientPhone = c.Row.Phone,
            LastVisitId = c.Row.LastVisitId,
            LastVisitClosedAt = c.Row.ClosedAt,
            LastConfirmedGrade = grades.TryGetValue(c.Row.LastVisitId, out var g) ? g : null,
            LastConfirmedGradeLabel = grades.TryGetValue(c.Row.LastVisitId, out var g2)
                ? DiagnosesService.GradeLabel(g2) : null,
            Referral = (byte?)c.Row.Referral,
            RecheckMonths = c.Row.RecheckMonths,
            DueDate = c.Due,
            DaysPastDue = c.PastDue,
            IsOverdue = c.PastDue > 0,
            StatusLabel = Label(c.PastDue)
        }).ToList();

        return Ok(new PagedResult<RecheckDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }

    /// <summary>Số bệnh nhân quá hạn, để hiện badge trên thanh điều hướng.</summary>
    public async Task<IActionResult> OverdueCount()
    {
        var today = _clock.LocalToday;

        var rows = await _repository.Visits.AsNoTracking()
            .Where(v => v.Status == VisitStatus.Completed && v.ClosedAt != null && v.RecheckMonths != null)
            .Select(v => new { v.PatientId, ClosedAt = v.ClosedAt!.Value, Months = v.RecheckMonths!.Value })
            .ToListAsync();

        var latestPerPatient = rows
            .GroupBy(r => r.PatientId)
            .Select(g => g.OrderByDescending(r => r.ClosedAt).First());

        var allVisits = await _repository.Visits.AsNoTracking()
            .GroupBy(v => v.PatientId)
            .Select(g => new { PatientId = g.Key, Latest = g.Max(v => v.VisitDate) })
            .ToDictionaryAsync(x => x.PatientId, x => x.Latest);

        var overdue = latestPerPatient.Count(r =>
            (!allVisits.TryGetValue(r.PatientId, out var latest) || latest <= r.ClosedAt) &&
            DateOnly.FromDateTime(r.ClosedAt.AddMonths(r.Months)) < today);

        return Ok(new { overdue });
    }

    /* ----------------------------------------------------------------- */

    private async Task<RecheckDto?> BuildAsync(int patientId)
    {
        EnsureCanAccessPatient(_me, patientId);

        var visit = await _repository.Visits.AsNoTracking()
            .Where(v => v.PatientId == patientId && v.Status == VisitStatus.Completed
                        && v.ClosedAt != null && v.RecheckMonths != null)
            .OrderByDescending(v => v.ClosedAt)
            .OrderByDescending(v => v.ClosedAt)
            .Select(v => new
            {
                v.Id,
                ClosedAt = v.ClosedAt!.Value,
                Months = v.RecheckMonths!.Value,
                v.Referral
            })
            .FirstOrDefaultAsync();

        if (visit is null) return null;

        var patient = await _repository.Patients.AsNoTracking()
            .Where(p => p.Id == patientId)
            .Select(p => new { p.Code, p.FullName, p.Phone })
            .FirstOrDefaultAsync();

        if (patient is null) return null;

        var grade = await _repository.DiagnosisReviews.AsNoTracking()
            .Where(r => r.AiDiagnosis != null && 
                        r.AiDiagnosis.FundusImage != null && 
                        r.AiDiagnosis.FundusImage.VisitId == visit.Id)
            .Select(r => (byte?)(byte)r.FinalGrade)
            .MaxAsync();

        var due = DateOnly.FromDateTime(visit.ClosedAt.AddMonths(visit.Months));
        var pastDue = _clock.LocalToday.DayNumber - due.DayNumber;

        return new RecheckDto
        {
            PatientId = patientId,
            PatientCode = patient.Code,
            PatientName = patient.FullName,
            PatientPhone = patient.Phone,
            LastVisitId = visit.Id,
            LastVisitClosedAt = visit.ClosedAt,
            LastConfirmedGrade = grade,
            LastConfirmedGradeLabel = grade is byte g ? DiagnosesService.GradeLabel(g) : null,
            Referral = (byte?)visit.Referral,
            RecheckMonths = visit.Months,
            DueDate = due,
            DaysPastDue = pastDue,
            IsOverdue = pastDue > 0,
            StatusLabel = Label(pastDue)
        };
    }

    private static string Label(int daysPastDue) => daysPastDue switch
    {
        > 90 => "Quá hạn trên 3 tháng",
        > 0 => $"Quá hạn {daysPastDue} ngày",
        > -8 => "Đến hạn trong tuần này",
        > -31 => "Đến hạn trong tháng này",
        _ => $"Còn {-daysPastDue} ngày"
    };
}
