using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Entities;
using Microsoft.AspNetCore.Mvc;

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

    public async Task<ActionResult<PagedResult<VisitDto>>> List(
        int? patientId, int? doctorId, DateOnly? from, DateOnly? to, byte? status, PageQuery page)
    {
        if (from is DateOnly fromDate && to is DateOnly toDate && fromDate > toDate)
            throw AppException.BadRequest(Msg.InvalidData, "Ngày bắt đầu không được lớn hơn ngày kết thúc.");

        DateTime? fromUtc = from is DateOnly f ? _clock.ToUtc(f.ToDateTime(TimeOnly.MinValue)) : null;
        DateTime? toExclusiveUtc = to is DateOnly t ? _clock.ToUtc(t.AddDays(1).ToDateTime(TimeOnly.MinValue)) : null;
        var data = await _repository.GetVisitPageAsync(patientId, doctorId, status, fromUtc, toExclusiveUtc, page);
        return Ok(new PagedResult<VisitDto>
        {
            Items = data.Items.Select(ToLocalVisitDto).ToList(),
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = data.Total
        });
    }

    public async Task<ActionResult<VisitDto>> Get(int id)
    {
        var visit = await _repository.GetVisitDtoAsync(id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");
        return Ok(ToLocalVisitDto(visit));
    }

    public async Task<ActionResult<VisitDto>> Create(CreateVisitRequest req)
    {
        var patient = await _repository.GetPatientByIdAsync(
                req.PatientId,
                tracking: false);

        if (patient is null)
        {
            throw AppException.NotFound(
                Msg.PatientNotFound,
                "Không tìm thấy hồ sơ bệnh nhân.");
        }
        //if (!await _repository.PatientExistsAsync(req.PatientId))
        //    throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        if (!await _repository.IsActiveUserInRoleAsync(req.DoctorId, Roles.Doctor))
            throw AppException.BadRequest(Msg.InvalidData, "Bác sĩ phụ trách không tồn tại, bị khóa hoặc role Doctor không còn active.");
        if (await _repository.HasOpenVisitAsync(req.PatientId))
            throw AppException.BadRequest(Msg.SlotTaken,
                "Bệnh nhân này đang có lượt khám chưa đóng. Vui lòng đóng lượt khám cũ trước khi tạo lượt khám mới.");

        var dayOfWeek = (byte)_clock.LocalNow.DayOfWeek;
        //if (!await _repository.IsDoctorOnDutyAsync(req.DoctorId, dayOfWeek))
        //    throw AppException.BadRequest(Msg.SlotTaken, "Bác sĩ được chọn không có ca trực tại thời điểm tiếp nhận.");
        Visit? createdVisit = null;
        //var visit = new Visit
        //{
        //    PatientId = req.PatientId,
        //    DoctorId = req.DoctorId,
        //    VisitDate = _clock.UtcNow,
        //    Status = VisitStatus.InProgress
        //};
        await _repository.ExecuteInTransactionAsync(async () =>
        {
            var medicalRecord =
            await _repository.GetActiveMedicalRecordByPatientIdAsync(
                patient.Id,
                tracking: true);
            //TH medicalRecord null thì add trước đã
            if (medicalRecord is null)
            {
                medicalRecord = new MedicalRecord
                {
                    PatientId = patient.Id,

                    // Giữ cùng format với dữ liệu migration:
                    // MR-{Patient.Code}
                    RecordCode = $"MR-{patient.Code}",

                    CreatedAt = _clock.UtcNow,

                    CreatedByUserId = _me.RequireId(),

                    IsVoided = false
                };

                _repository.Add(medicalRecord);

                // Phải save ở đây để SQL Server sinh MedicalRecord.Id.
                await _repository.CommitAsync();
            }
            // --------------------------------------------------------
            // MedicalRecord lúc này chắc chắn đã có Id.
            // Dùng Id đó làm FK cho MedicalVisit.
            // --------------------------------------------------------
            var visit = new Visit
            {

                MedicalRecordId = medicalRecord.Id,

                DoctorId = req.DoctorId,

                VisitDate = _clock.UtcNow,

                Status = VisitStatus.InProgress
            };

            _repository.Add(visit);

            await _repository.CommitAsync();

            createdVisit = visit;


            if (visit.DoctorId is int doctorId)
            {
                var patientName = await _repository.GetPatientNameAsync(visit.MedicalRecord.PatientId) ?? "bệnh nhân";
                _notify.Push(doctorId, NotificationType.Visit, "Lượt khám mới được giao",
                    $"Bạn được giao lượt khám cho {patientName}.", nameof(Visit), visit.Id);
                await _repository.CommitAsync();
            }
        });

       

        var dto = await RequireVisitDtoAsync(createdVisit.Id);

        dto.VisitDate =
            _clock.ToLocal(dto.VisitDate)!.Value;

        dto.CreatedAt =
            _clock.ToLocal(createdVisit.CreatedAt)!.Value;


        return CreatedAtAction(
            nameof(Get),
            new { id = createdVisit.Id },
            dto);
        
    }

    public async Task<ActionResult<VisitDto>> Close(int id, CloseVisitRequest req)
    {
        var visit = await _repository.GetVisitForUpdateAsync(id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám cần đóng.");
        _repository.ApplyOriginalRowVersion(visit, req.RowVersion);
        if (visit.Status == VisitStatus.Completed)
            throw AppException.BadRequest(Msg.ApptImmutable, "Lượt khám đã được đóng.");
        if (visit.DoctorId != _me.RequireId())
            throw AppException.Forbidden(Msg.Forbidden, "Bạn không phải bác sĩ phụ trách lượt khám này nên không thể đóng.");
        if (string.IsNullOrWhiteSpace(req.Conclusion))
            throw AppException.BadRequest(Msg.ConclusionNeeded, "Chưa nhập kết luận nên không thể đóng lượt khám.");

        var validation = await _repository.GetVisitCloseDataAsync(id);
        if (validation.PendingImages > 0)
            throw AppException.BadRequest(Msg.ConclusionNeeded,
                $"Còn {validation.PendingImages} ảnh đáy mắt chưa được duyệt chất lượng.");
        if (validation.ImagesWithoutAi > 0)
            throw AppException.BadRequest(Msg.ConclusionNeeded,
                $"Còn {validation.ImagesWithoutAi} ảnh đáy mắt đã đạt chất lượng nhưng chưa được chạy AI.");

        var withoutReview = validation.TotalAi - validation.ReviewedAi;
        if (withoutReview > 0)
            throw AppException.BadRequest(Msg.ConclusionNeeded,
                $"Còn {withoutReview}/{validation.TotalAi} kết quả AI chưa được bác sĩ phê duyệt.");

        visit.Conclusion = req.Conclusion.Trim();
        visit.Referral = req.Referral;
        visit.RecheckMonths = req.RecheckMonths
            ?? (validation.WorstGrade is byte grade
                ? await _cfg.GetRecheckMonthsAsync((DrGrade)grade)
                : (byte)12);
        visit.Status = VisitStatus.Completed;
        visit.ClosedAt = _clock.UtcNow;

        var patient = await _repository.GetPatientAsync(visit.MedicalRecord.PatientId)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");

        _notify.PushToPatient(patient, NotificationType.Result, "Kết quả khám đã được xác nhận",
            $"Kết quả lượt khám ngày {_clock.ToLocal(visit.VisitDate):dd/MM/yyyy} đã được bác sĩ xác nhận.",
            nameof(Visit), visit.Id);

        var dueDate = _clock.ToLocal(visit.ClosedAt)!.Value.AddMonths(visit.RecheckMonths.Value);
        var referralNote = visit.Referral.HasValue && visit.Referral.Value >= ReferralType.Ophthalmology
            ? " Bạn cũng cần đến Khoa Mắt theo chỉ định của bác sĩ." : "";
        _notify.PushToPatient(patient, NotificationType.Recheck, "Lịch tái tầm soát tiếp theo",
            $"Bạn cần tái tầm soát võng mạc trước ngày {dueDate:dd/MM/yyyy} " +
            $"(sau {visit.RecheckMonths} tháng). Vui lòng đến phòng khám trong giờ làm việc.{referralNote}",
            nameof(Visit), visit.Id);

        await _audit.LogAsync(AuditAction.VisitClose, nameof(Visit), visit.Id, null, new
        {
            visit.Conclusion,
            Referral = visit.Referral?.ToString(),
            visit.RecheckMonths,
            worstGrade = validation.WorstGrade
        });
        await _repository.CommitAsync();

        var dto = await RequireVisitDtoAsync(visit.Id);
        dto.VisitDate = _clock.ToLocal(dto.VisitDate)!.Value;
        dto.ClosedAt = _clock.ToLocal(dto.ClosedAt);
        return Ok(dto);
    }

    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        var visit = await _repository.GetVisitForUpdateAsync(id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");

        if (visit.Status == VisitStatus.Completed)
            throw AppException.Conflict(
                Msg.ApptImmutable,
                "Lượt khám đã được đóng. Hồ sơ của lượt khám này chỉ được xem và không thể chỉnh sửa hoặc thu hồi.");

        var allowedAsDoctor = _me.IsInRole(Roles.Doctor) && visit.DoctorId == _me.RequireId();
        var allowedAsReceptionist = false;
        if (_me.IsInRole(Roles.Receptionist))
        {
            if (visit.Status == VisitStatus.InProgress && !await _repository.VisitHasClinicalDataAsync(id))
                allowedAsReceptionist = true;
        }

        if (!allowedAsDoctor && !allowedAsReceptionist)
        {
            if (_me.IsInRole(Roles.Receptionist) && visit.Status != VisitStatus.InProgress)
                throw AppException.Forbidden(Msg.Forbidden, "Lượt khám đã hoàn tất, chỉ bác sĩ phụ trách mới được thu hồi.");
            if (_me.IsInRole(Roles.Receptionist) && await _repository.VisitHasClinicalDataAsync(id))
                throw AppException.Forbidden(Msg.Forbidden, "Lượt khám đã có dữ liệu lâm sàng, chỉ bác sĩ phụ trách mới được thu hồi.");
            throw AppException.Forbidden(Msg.Forbidden, "Bạn không có quyền thu hồi lượt khám này.");
        }

        await _void.VoidVisitAsync(id, req.Reason, req.RowVersion);
        return Ok(new { message = "Đã thu hồi lượt khám và các bản ghi liên quan." });
    }

    public async Task<PagedResult<VisitDto>> GetMineAsync(int userId, PageQuery page)
    {
        var patientId = await RequirePatientIdForUserAsync(userId);
        var data = await _repository.GetCompletedVisitsForPatientAsync(patientId, page);
        return new PagedResult<VisitDto>
        { Items = data.Items.Select(ToLocalVisitDto).ToList(), Page = page.Page, PageSize = page.PageSize, TotalItems = data.Total };
    }

    public async Task<VisitDto> GetMineByIdAsync(int userId, int visitId)
    {
        var patientId = await RequirePatientIdForUserAsync(userId);
        var dto = await _repository.GetCompletedVisitForPatientAsync(patientId, visitId)
        ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");
        dto.VisitDate = _clock.ToLocal(dto.VisitDate)!.Value;
        dto.CreatedAt = _clock.ToLocal(dto.CreatedAt)!.Value;
        dto.ClosedAt = _clock.ToLocal(dto.ClosedAt);

        return dto;
    }

    private async Task<int> RequirePatientIdForUserAsync(int userId)
    {
        var patientId = await _repository.GetPatientIdByUserIdAsync(userId);
        return patientId ?? throw AppException.NotFound(Msg.PatientNotFound,
            "Tài khoản chưa được liên kết với hồ sơ bệnh nhân.");
    }

    private async Task<VisitDto> RequireVisitDtoAsync(int id) =>
        await _repository.GetVisitDtoAsync(id)
        ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy lượt khám.");
    private VisitDto ToLocalVisitDto(VisitDto dto)
    {
        dto.VisitDate = _clock.ToLocal(dto.VisitDate)!.Value;
        dto.CreatedAt = _clock.ToLocal(dto.CreatedAt)!.Value;
        dto.ClosedAt = _clock.ToLocal(dto.ClosedAt);

        return dto;
    }
}
