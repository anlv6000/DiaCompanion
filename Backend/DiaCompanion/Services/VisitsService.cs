using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-18..21 — lượt khám.</summary>
public class VisitsService : BaseService, IVisitsService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IVoidService _void;
    private readonly IConfigService _cfg;
    private readonly INotificationService _notify;
    private readonly IClinicClock _clock;

    public VisitsService(IRepository repository, ICurrentUser me, IAuditService audit,
                            IVoidService voidSvc, IConfigService cfg, INotificationService notify, IClinicClock clock)
    { _repository = repository; _me = me; _audit = audit; _void = voidSvc; _cfg = cfg; _notify = notify; _clock = clock; }

    /// <summary>
    /// Danh sách lượt khám dùng chung cho danh sách toàn quầy và lịch sử bệnh nhân.
    /// Chỉ lọc theo bác sĩ khi doctorId được truyền rõ ràng. Trang "Lượt khám của tôi"
    /// dùng endpoint riêng, nơi controller lấy doctorId từ JWT.
    /// </summary>
    public async Task<ActionResult<PagedResult<VisitDto>>> List(
        int? patientId, int? doctorId, DateOnly? from, DateOnly? to,
        byte? status, PageQuery page)
    {
        if (from is DateOnly fromDate && to is DateOnly toDate && fromDate > toDate)
            throw AppException.BadRequest(Msg.InvalidData,
                "Ngày bắt đầu không được lớn hơn ngày kết thúc.");

        var query = _repository.Visits.AsNoTracking();

        if (patientId is int pid)
            query = query.Where(v => v.PatientId == pid);

        // Chỉ lọc bác sĩ khi client/endpoint chuyên biệt truyền doctorId.
        // Vì vậy tab lịch sử của bệnh nhân (chỉ truyền patientId) luôn thấy đầy đủ
        // các lượt, kể cả do nhiều bác sĩ khác nhau phụ trách.
        if (doctorId is int did)
            query = query.Where(v => v.DoctorId == did);

        if (status is byte st)
            query = query.Where(v => (byte)v.Status == st);

        // VisitDate lưu UTC. Chuyển biên ngày địa phương sang UTC trước khi lọc.
        if (from is DateOnly f)
        {
            var fromUtc = _clock.ToUtc(f.ToDateTime(TimeOnly.MinValue));
            query = query.Where(v => v.VisitDate >= fromUtc);
        }

        if (to is DateOnly t)
        {
            // Dùng mốc đầu ngày kế tiếp và toán tử < để không phụ thuộc độ chính
            // xác phần thập phân của SQL Server DateTime/DateTime2.
            var toExclusiveUtc = _clock.ToUtc(t.AddDays(1).ToDateTime(TimeOnly.MinValue));
            query = query.Where(v => v.VisitDate < toExclusiveUtc);
        }

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(v => v.VisitDate)
            .ThenByDescending(v => v.Id)
            .Skip(page.Skip).Take(page.PageSize)
            .Select(MapVisit).ToListAsync();

        return Ok(new PagedResult<VisitDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }

    /// <summary>UC-19 — chi tiết lượt khám kèm ảnh, kết quả AI và review.</summary>
    public async Task<ActionResult<VisitDto>> Get(int id)
    {
        var v = await _repository.Visits.AsNoTracking().Where(x => x.Id == id).Select(MapVisit)
            .FirstOrDefaultAsync()
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");
        return Ok(v);
    }

    /// <summary>UC-18 — tạo lượt khám.</summary>
    public async Task<ActionResult<VisitDto>> Create(CreateVisitRequest req)
    {
        
        if (!await _repository.Patients.AnyAsync(p => p.Id == req.PatientId))
            throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        var doctorExits = await _repository.Users.AnyAsync(
                    u => u.Id == req.DoctorId && u.Role == UserRole.Doctor && u.IsActive);

        if (!doctorExits)
            throw AppException.BadRequest(Msg.InvalidData, "Bác sĩ phụ trách không tồn tại hoặc không còn hoạt động.");

        var hasOpenVisit = await _repository.Visits.AnyAsync(
                    v => v.PatientId == req.PatientId && v.Status == VisitStatus.InProgress && !v.IsVoided);

        if (hasOpenVisit)
            throw AppException.BadRequest(Msg.SlotTaken, "Bệnh nhân này đang có lượt khám chưa đóng. Vui lòng đóng lượt khám cũ trước khi tạo lượt khám mới.");

        var localNow = _clock.LocalNow;
        //var currentShift = ResolveShift(localNow);
        var dayOfWeek = (byte)localNow.DayOfWeek;

        var isDoctorOnDuty = await _repository.DoctorShifts.AnyAsync(s =>
            s.DoctorId == req.DoctorId &&
            s.DayOfWeek == dayOfWeek &&
            //s.Shift == currentShift &&
            s.IsActive);
        if (!isDoctorOnDuty)
            throw AppException.BadRequest(Msg.SlotTaken, "Bác sĩ được chọn không có ca trực tại thời điểm tiếp nhận.");
        var visit = new Visit
        {
            PatientId = req.PatientId,
            DoctorId = req.DoctorId,
            VisitDate = _clock.UtcNow,
            Status = VisitStatus.InProgress
        };

        _repository.Visits.Add(visit);
        await _repository.SaveChangesAsync();

        // Sau lần SaveChanges đầu tiên visit đã có Id, lúc này mới tạo thông báo
        // để linkEntityId trỏ chính xác tới lượt khám vừa được giao.
        if (visit.DoctorId is int assignedDoctorId)
        {
            var patientName = await _repository.Patients.AsNoTracking()
                .Where(p => p.Id == visit.PatientId)
                .Select(p => p.FullName)
                .FirstOrDefaultAsync() ?? "bệnh nhân";

            _notify.Push(
                assignedDoctorId,
                NotificationType.Visit,
                "Lượt khám mới được giao",
                $"Bạn được giao lượt khám cho {patientName}.",
                linkEntity: nameof(Visit),
                linkEntityId: visit.Id);

            await _repository.SaveChangesAsync();
        }

        var dto = await GetDtoAsync(visit.Id);
        dto.VisitDate = _clock.ToLocal(dto.VisitDate)!.Value;
        dto.CreatedAt = _clock.ToLocal(visit.CreatedAt)!.Value;
        return CreatedAtAction(nameof(Get), new { id = visit.Id }, dto);
    }

    /// <summary>
    /// UC-20 — nhập kết luận và đóng lượt khám.
    /// BR-12: bắt buộc có kết luận. BR-19: chu kỳ tái khám suy từ mức DR đã xác nhận.
    /// </summary>
    public async Task<ActionResult<VisitDto>> Close(int id, CloseVisitRequest req)
    {
        var v = await _repository.Visits.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám cần đóng.");

        if (v.Status == VisitStatus.Completed)
            throw AppException.BadRequest(Msg.ApptImmutable, "Lượt khám đã được đóng.");

        var doctorId = _me.RequireId();
        if (v.DoctorId != doctorId)
            throw AppException.Forbidden(
                Msg.Forbidden,
                "Bạn không phải bác sĩ phụ trách lượt khám này nên không thể đóng.");

        if (string.IsNullOrWhiteSpace(req.Conclusion))
            throw AppException.BadRequest(
                Msg.ConclusionNeeded,
                "Chưa nhập kết luận nên không thể đóng lượt khám.");


        var gradableImageIds = _repository.FundusImages
    .Where(f =>
        f.VisitId == id &&
        !f.IsVoided &&
        f.QualityStatus == QualityStatus.Gradable)
    .Select(f => f.Id);

        // 1. Đếm ảnh vẫn đang chờ duyệt chất lượng.
        var pendingQualityImages = await _repository.FundusImages
            .CountAsync(f =>
                f.VisitId == id &&
                !f.IsVoided &&
                f.QualityStatus == QualityStatus.Pending);

        if (pendingQualityImages > 0)
        {
            throw AppException.BadRequest(
                Msg.ConclusionNeeded,
                $"Còn {pendingQualityImages} ảnh đáy mắt chưa được duyệt chất lượng.");
        }

        // 2. Ảnh đã đạt chất lượng nhưng chưa chạy AI,
        // tức là chưa có AiDiagnosis hợp lệ nào.
        var imagesWithoutAiDiagnosis = await _repository.FundusImages
            .CountAsync(f =>
                f.VisitId == id &&
                !f.IsVoided &&
                f.QualityStatus == QualityStatus.Gradable &&
                !_repository.AiDiagnoses.Any(d =>
                    d.FundusImageId == f.Id &&
                    !d.IsVoided));

        if (imagesWithoutAiDiagnosis > 0)
        {
            throw AppException.BadRequest(
                Msg.ConclusionNeeded,
                $"Còn {imagesWithoutAiDiagnosis} ảnh đáy mắt đã đạt chất lượng nhưng chưa được chạy AI.");
        }

        // 3. Lấy tất cả các lần chạy AI hợp lệ
        // của các ảnh đạt chất lượng trong lượt khám.
        var aiDiagnosesOfVisit = _repository.AiDiagnoses
            .Where(d =>
                !d.IsVoided &&
                gradableImageIds.Contains(d.FundusImageId));


        // Tổng số lần chạy AI.
        var totalAiDiagnoses = await aiDiagnosesOfVisit.CountAsync();


        // Đếm số lần chạy AI đã có ít nhất một review hợp lệ.
        var reviewedAiDiagnoses = await aiDiagnosesOfVisit
            .CountAsync(d =>
                _repository.DiagnosisReviews.Any(r =>
                    r.AiDiagnosisId == d.Id &&
                    !r.IsVoided));


        // Số lần chạy AI còn thiếu review.
        var aiDiagnosesWithoutReview =
            totalAiDiagnoses - reviewedAiDiagnoses;

        if (aiDiagnosesWithoutReview > 0)
        {
            throw AppException.BadRequest(
                Msg.ConclusionNeeded,
                $"Còn {aiDiagnosesWithoutReview}/{totalAiDiagnoses} kết quả AI chưa được bác sĩ phê duyệt.");
        }

        var worstGrade = await _repository.DiagnosisReviews
            .Where(r =>
                !r.IsVoided &&
                r.AiDiagnosis != null &&
                !r.AiDiagnosis.IsVoided &&
                r.AiDiagnosis.FundusImage != null &&
                r.AiDiagnosis.FundusImage.VisitId == id &&
                !r.AiDiagnosis.FundusImage.IsVoided)
            .Select(r => (byte?)(byte)r.FinalGrade)
            .MaxAsync();

        v.Conclusion = req.Conclusion.Trim();
        v.Referral = req.Referral;
        v.RecheckMonths = req.RecheckMonths
            ?? (worstGrade is byte g
                ? await _cfg.GetRecheckMonthsAsync((DrGrade)g)
                : (byte)12);

        v.Status = VisitStatus.Completed;
        v.ClosedAt = _clock.UtcNow;

        var patient = await _repository.Patients.FirstAsync(p => p.Id == v.PatientId);

        _notify.PushToPatient(
            patient,
            NotificationType.Result,
            "Kết quả khám đã được xác nhận",
            $"Kết quả lượt khám ngày {_clock.ToLocal(v.VisitDate):dd/MM/yyyy} đã được bác sĩ xác nhận.",
            nameof(Visit),
            v.Id);

        var dueDate = _clock.ToLocal(v.ClosedAt)!.Value.AddMonths(v.RecheckMonths.Value);
        var referralNote = v.Referral >= ReferralType.Ophthalmology
            ? " Bạn cũng cần đến Khoa Mắt theo chỉ định của bác sĩ."
            : "";

        _notify.PushToPatient(
            patient,
            NotificationType.Recheck,
            "Lịch tái tầm soát tiếp theo",
            $"Bạn cần tái tầm soát võng mạc trước ngày {dueDate:dd/MM/yyyy} " +
            $"(sau {v.RecheckMonths} tháng). Vui lòng đến phòng khám trong giờ làm việc.{referralNote}",
            nameof(Visit),
            v.Id);

        await _audit.LogAsync(
            AuditAction.VisitClose,
            nameof(Visit),
            v.Id,
            null,
            new
            {
                v.Conclusion,
                Referral = v.Referral?.ToString(),
                v.RecheckMonths,
                worstGrade
            });

        await _repository.SaveChangesAsync();

        var dto = await GetDtoAsync(v.Id);
        dto.VisitDate = _clock.ToLocal(dto.VisitDate)!.Value;
        dto.ClosedAt = _clock.ToLocal(dto.ClosedAt);

        return Ok(dto);
    }

    /// <summary>UC-21 — thu hồi lượt khám (lan sang ảnh, kết quả AI, review, đơn thuốc).</summary>
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        var visit = await _repository.Visits.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");

        if (_me.Role == UserRole.Doctor)
        {
            // Bác sĩ chỉ được thu hồi lượt do chính mình phụ trách.
            if (visit.DoctorId != _me.RequireId())
                throw AppException.Forbidden(Msg.Forbidden,
                    "Bạn không phải bác sĩ phụ trách lượt khám này nên không thể thu hồi.");
        }
        else if (_me.Role == UserRole.Receptionist)
        {
            // Lễ tân chỉ được hủy lượt tạo nhầm khi lượt còn đang mở và chưa phát
            // sinh dữ liệu lâm sàng. Khi đã có ảnh hoặc đơn thuốc, chỉ bác sĩ phụ
            // trách mới được phép thực hiện thao tác lan truyền này.
            if (visit.Status != VisitStatus.InProgress)
                throw AppException.Forbidden(Msg.Forbidden,
                    "Lượt khám đã hoàn tất, chỉ bác sĩ phụ trách mới được thu hồi.");

            var hasClinicalData = await _repository.FundusImages
                .AnyAsync(i => i.VisitId == id)
                || await _repository.Prescriptions
                    .AnyAsync(p => p.VisitId == id);

            if (hasClinicalData)
                throw AppException.Forbidden(Msg.Forbidden,
                    "Lượt khám đã có dữ liệu lâm sàng, chỉ bác sĩ phụ trách mới được thu hồi.");
        }
        else
        {
            throw AppException.Forbidden(Msg.Forbidden,
                "Bạn không có quyền thu hồi lượt khám.");
        }

        await _void.VoidVisitAsync(id, req.Reason);
        return Ok(new { message = "Đã thu hồi lượt khám và các bản ghi liên quan." });
    }

    private async Task<VisitDto> GetDtoAsync(int id) =>
        await _repository.Visits.AsNoTracking().Where(v => v.Id == id).Select(MapVisit).FirstAsync();

    public async Task<PagedResult<VisitDto>> GetMineAsync(int userId, PageQuery page)
    {
        var patientId = await GetPatientIdByUserIdAsync(userId);

        var query = _repository.Visits
            .AsNoTracking()
            .Where(v =>
                v.PatientId == patientId &&
                v.Status == VisitStatus.Completed);

        var totalItems = await query.CountAsync();

        var items = await query
            .OrderByDescending(v => v.VisitDate)
            .ThenByDescending(v => v.Id)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .Select(v => new VisitDto
            {
                Id = v.Id,
                PatientId = v.PatientId,
                DoctorId = v.DoctorId,
                VisitDate = v.VisitDate,
                Status = (byte)v.Status,
                Conclusion = v.Conclusion,
                Referral = (byte?)v.Referral,
                RecheckMonths = v.RecheckMonths,
                ClosedAt = v.ClosedAt

                // Thêm các trường còn lại đúng theo VisitDto của bạn.
            })
            .ToListAsync();

        return new PagedResult<VisitDto>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = totalItems
        };
    }

    public async Task<VisitDto> GetMineByIdAsync(int userId, int visitId)
    {
        var patientId = await GetPatientIdByUserIdAsync(userId);

        var visit = await _repository.Visits
            .AsNoTracking()
            .Where(v =>
                v.Id == visitId &&
                v.PatientId == patientId &&
                v.Status == VisitStatus.Completed)
            .Select(v => new VisitDto
            {
                Id = v.Id,
                PatientId = v.PatientId,
                DoctorId = v.DoctorId,
                VisitDate = v.VisitDate,
                Status = (byte)v.Status,
                Conclusion = v.Conclusion,
                Referral = (byte?)v.Referral,
                RecheckMonths = v.RecheckMonths,
                ClosedAt = v.ClosedAt,
                CreatedAt = v.CreatedAt
                // Thêm các trường còn lại đúng theo VisitDto của bạn.
            })
            .FirstOrDefaultAsync();

        if (visit is null)
        {
            throw AppException.NotFound(
                Msg.LoadFailed,
                "Không tìm thấy lượt khám.");
        }

        return visit;
    }


    private async Task<int> GetPatientIdByUserIdAsync(int userId)
    {
        var patientId = await _repository.Patients
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => (int?)p.Id)
            .FirstOrDefaultAsync();

        if (patientId is null)
        {
            throw AppException.NotFound(
                Msg.PatientNotFound,
                "Tài khoản chưa được liên kết với hồ sơ bệnh nhân.");
        }

        return patientId.Value;
    }

    public async Task CreateAsync(int userId, CreateFeedbackRequest req)
    {
        var patientId = await GetPatientIdAsync(userId);

        ValidateRequest(req);

        if (req.VisitId is int visitId)
        {
            await ValidateVisitAsync(
                patientId,
                visitId);

            await CheckDuplicateAsync(
                patientId,
                visitId);
        }

        var feedback = new Feedback
        {
            PatientId = patientId,
            VisitId = req.VisitId,
            Rating = req.Rating,
            Tags = string.IsNullOrWhiteSpace(req.Tags) ? null : req.Tags.Trim(),
            Comment = string.IsNullOrWhiteSpace(req.Comment) ? null : req.Comment.Trim()
        };

        _repository.Feedbacks.Add(feedback);

        await _repository.SaveChangesAsync();
    }


    private static void ValidateRequest(
        CreateFeedbackRequest req)
    {
        if (req.Rating is < 1 or > 5)
        {
            throw AppException.BadRequest(
                Msg.RequiredFields,
                "Đánh giá phải từ 1 đến 5 sao.");
        }

        if (string.IsNullOrWhiteSpace(req.Comment))
        {
            throw AppException.BadRequest(
                Msg.RequiredFields,
                "Vui lòng nhập nội dung phản hồi.");
        }
    }

    private async Task ValidateVisitAsync(
        int patientId,
        int visitId)
    {
        var ownsVisit = await _repository.Visits
            .AsNoTracking()
            .AnyAsync(v =>
                v.Id == visitId &&
                v.PatientId == patientId &&
                v.Status == VisitStatus.Completed);

        if (!ownsVisit)
        {
            throw AppException.NotFound(
                Msg.LoadFailed,
                "Không tìm thấy lượt khám phù hợp.");
        }
    }

    private async Task CheckDuplicateAsync(
        int patientId,
        int visitId)
    {
        var existed = await _repository.Feedbacks
            .AsNoTracking()
            .AnyAsync(f =>
                f.PatientId == patientId &&
                f.VisitId == visitId);

        if (existed)
        {
            throw AppException.BadRequest(
                Msg.RequiredFields,
                "Bạn đã gửi phản hồi cho lượt khám này.");
        }
    }

    private async Task<int> GetPatientIdAsync(int userId)
    {
        var patientId = await _repository.Patients
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => (int?)p.Id)
            .FirstOrDefaultAsync();

        if (patientId is null)
        {
            throw AppException.NotFound(
                Msg.PatientNotFound,
                "Không tìm thấy hồ sơ bệnh nhân.");
        }

        return patientId.Value;
    }

    /// <summary>
    /// Dùng Expression chứ không phải method thường: EF Core chỉ dịch được
    /// Expression sang SQL. Gọi một static method trong Select sẽ khiến EF
    /// kéo toàn bộ bảng về bộ nhớ rồi mới chiếu.
    /// </summary>
    private static readonly System.Linq.Expressions.Expression<Func<Visit, VisitDto>> MapVisit = v => new VisitDto
    {
        Id = v.Id,
        PatientId = v.PatientId,
        PatientName = v.Patient!.FullName,
        PatientCode = v.Patient.Code,
        DoctorId = v.DoctorId,
        DoctorName = v.Doctor != null ? v.Doctor.FullName : null,
        VisitDate = v.VisitDate,
        Status = (byte)v.Status,
        Conclusion = v.Conclusion,
        Referral = (byte?)v.Referral,
        RecheckMonths = v.RecheckMonths,
        ClosedAt = v.ClosedAt,
        ImageCount = v.Images.Count(i => !i.IsVoided),
        PendingReviewCount = v.Images
            .SelectMany(i => i.Diagnoses)
            .Count(d => !d.IsVoided && !d.Reviews.Any(r => !r.IsVoided))
    };
    //private static ShiftType ResolveShift(DateTime localNow)
    //{
    //    var time = localNow.TimeOfDay;

    //    if (time >= TimeSpan.FromHours(7) && time < TimeSpan.FromHours(12))
    //        return ShiftType.Morning;

    //    if (time >= TimeSpan.FromHours(13) && time < TimeSpan.FromHours(17))
    //        return ShiftType.Afternoon;

    //    throw AppException.BadRequest(
    //        Msg.InvalidData,
    //        "Hiện tại không nằm trong thời gian tiếp nhận khám.");
    //}
}
