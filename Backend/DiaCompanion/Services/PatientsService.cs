using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-12..17 — nghiệp vụ hồ sơ bệnh nhân. Không truy cập EF/DbContext trực tiếp.</summary>
public class PatientsService : BaseService, IPatientsService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IPasswordHasher _hasher;
    private readonly IVoidService _void;
    private readonly IClinicClock _clock;
    private readonly IOtpService _otp;

    public PatientsService(
        IRepository repository,
        ICurrentUser me,
        IAuditService audit,
        IPasswordHasher hasher,
        IVoidService voidSvc,
        IClinicClock clock,
        IOtpService otp)
    {
        _repository = repository;
        _me = me;
        _audit = audit;
        _hasher = hasher;
        _void = voidSvc;
        _clock = clock;
        _otp = otp;
    }

    public async Task<ActionResult<PagedResult<PatientListItemDto>>> Search(
        [FromQuery] string? q,
        [FromQuery] byte? diabetesType,
        [FromQuery] byte? grade,
        [FromQuery] PageQuery page)
    {
        string? normalized = null;
        if (!string.IsNullOrWhiteSpace(q))
        {
            q = q.Trim();
            if (q.Length < 2)
                throw AppException.BadRequest(Msg.RequiredFields, "Vui lòng nhập tối thiểu 2 ký tự để tìm kiếm.");
            normalized = VietnameseText.RemoveDiacritics(q);
        }

        var result = await _repository.SearchPatientsAsync(normalized, q, diabetesType, grade, page);
        var today = _clock.LocalToday;
        var items = result.Items.Select(r => new PatientListItemDto
        {
            Id = r.Id,
            Code = r.Code,
            FullName = r.FullName,
            Age = today.Year - r.DateOfBirth.Year,
            Gender = r.Gender,
            Phone = r.Phone,
            DiabetesType = r.DiabetesType,
            DiabetesDurationYears = r.DiabetesDurationYears,
            LatestDrGrade = r.LatestDrGrade,
            LatestVisitDate = r.LatestVisitDate,
            HasAccount = r.HasAccount
        }).ToList();

        return Ok(new PagedResult<PatientListItemDto>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = result.Total
        });
    }

    public async Task<ActionResult<PatientDetailDto>> Get(int id)
    {
        var patient = await _repository.GetPatientAsync(id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        return Ok(await ToDetailAsync(patient));
    }

    public async Task<ActionResult<PatientDetailDto>> GetMine()
    {
        var patientId = RequireMyPatientId(_me);
        var patient = await _repository.GetPatientAsync(patientId)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        return Ok(await ToDetailAsync(patient));
    }

    public async Task<ActionResult<CreatePatientResponse>> Create(CreatePatientRequest req)
    {
        var phone = NormalizePhone(req.Phone);
        if (await _repository.PatientPhoneExistsAsync(phone))
            throw AppException.Conflict(
                Msg.PhoneTaken,
                "Số điện thoại này đã được dùng cho một hồ sơ khác. Mỗi bệnh nhân cần một số riêng vì đây là định danh đăng nhập.");
        //check th user đó là khác bệnh nhân và đã có sđt 
        if (req.CreateAccount && req.ExistingUserId is null && await _repository.UserPhoneExistsAsync(phone))
            throw AppException.Conflict(Msg.PhoneTaken, "Số điện thoại này đã được dùng cho tài khoản khác.");

        if (req.BaselineHbA1c is decimal hba1c && (hba1c < 3 || hba1c > 20))
            throw AppException.BadRequest(Msg.RequiredFields, "HbA1c ban đầu phải nằm trong khoảng từ 3% đến 20%.");

        if (req.CreateAccount)
        {
            var patientRoles = await _repository.GetActiveRoleNamesByNamesAsync(new[] { Roles.Patient });
            if (!patientRoles.Contains(Roles.Patient, StringComparer.OrdinalIgnoreCase))
                throw AppException.Conflict(Msg.RequiredFields,
                    "Vai trò Patient chưa tồn tại hoặc đang bị khóa trong cơ sở dữ liệu.");
        }

        CreatePatientResponse? response = null;
        await _repository.ExecuteInTransactionAsync(async () =>
        {
            var patient = new Patient
            {
                Code = await NextCodeAsync(),
                FullName = req.FullName.Trim(),
                Gender = req.Gender,
                DateOfBirth = req.DateOfBirth,
                Phone = phone,
                Address = req.Address,
                DiabetesType = req.DiabetesType,
                DiabetesDurationYears = req.DiabetesDurationYears,
                BaselineHbA1c = req.BaselineHbA1c,
                Note = req.Note,
                CreatedBy = _me.RequireId()
            };

            User? linkedUser = null;
            TempCredentialResponse? credential = null;
            if (req.CreateAccount)
            {
                if (req.ExistingUserId is int existingUserId)
                {
                    linkedUser = await _repository.GetUserByIdAsync(existingUserId);
                    if (linkedUser is null)
                        throw AppException.NotFound(
                            Msg.RequiredFields,
                            "Tài khoản được chọn không tồn tại.");
                    var alreadyHasPatient = await _repository.UserAlreadyLinkedToActivePatientAsync(existingUserId);

                    if (alreadyHasPatient)
                        throw AppException.Conflict(
                            Msg.RequiredFields,
                            "Tài khoản này đã được liên kết với một hồ sơ bệnh nhân.");


                    // Có thể cập nhật phone cho User nếu trước đó chưa có
                    if (string.IsNullOrWhiteSpace(linkedUser.Phone))
                    {
                        var phoneTaken = await _repository.UserPhoneExistsExceptUserAsync(phone,linkedUser.Id);

                        if (phoneTaken)
                            throw AppException.Conflict(
                                Msg.PhoneTaken,
                                "Số điện thoại đã được sử dụng bởi tài khoản khác.");

                        linkedUser.Phone = phone;
                    }
                    else if (!string.Equals(
                 linkedUser.Phone,
                 phone,
                 StringComparison.Ordinal))
                    {
                        throw AppException.Conflict(
                            Msg.PhoneTaken,
                            "Số điện thoại hồ sơ bệnh nhân không khớp với tài khoản được chọn.");
                    }
                    var addedPatientRole = await _repository.EnsureUserRoleActiveAsync(linkedUser,Roles.Patient,_me.RequireId());

                    if (!addedPatientRole)
                        throw AppException.Conflict(
                            Msg.RequiredFields,
                            "Vai trò Patient chưa tồn tại hoặc đang bị khóa.");

                    patient.UserId = linkedUser.Id;
                }
                else
                {
                    if (await _repository.UserPhoneExistsAsync(phone))
                        throw AppException.Conflict(
                            Msg.PhoneTaken,
                            "Số điện thoại này đã được dùng cho tài khoản khác.");

                    var temp = _hasher.GenerateTempPassword();

                    linkedUser = new User
                    {
                        Phone = phone,
                        PasswordHash = _hasher.Hash(temp),
                        FullName = patient.FullName,
                        MustChangePassword = true
                    };

                    _repository.Add(linkedUser);
                    await _repository.CommitAsync();

                    if (!await _repository.EnsureUserRoleActiveAsync(
                            linkedUser,
                            Roles.Patient,
                            _me.RequireId()))
                    {
                        throw AppException.Conflict(
                            Msg.RequiredFields,
                            "Vai trò Patient chưa tồn tại hoặc đang bị khóa.");
                    }

                    patient.UserId = linkedUser.Id;

                    credential = new TempCredentialResponse
                    {
                        LoginId = phone,
                        TempPassword = temp,
                        Note =
                            "Mật khẩu tạm chỉ hiển thị một lần. In cho bệnh nhân; hệ thống sẽ bắt đổi mật khẩu ở lần đăng nhập đầu tiên."
                    };
                }
            }

            _repository.Add(patient);
            await _repository.CommitAsync();

            await _audit.LogAsync(
                AuditAction.PatientCreate,
                nameof(Patient),
                patient.Id,
                null,
                new { patient.Code, patient.FullName, patient.Phone, hasAccount = req.CreateAccount });
            await _repository.CommitAsync();

            response = new CreatePatientResponse
            {
                Patient = await ToDetailAsync(patient),
                Account = credential
            };
        });

        return CreatedAtAction(nameof(Get), new { id = response!.Patient.Id }, response);
    }

    public async Task<ActionResult<PatientDetailDto>> Update(int id, UpdatePatientRequest req)
    {
        var patient = await _repository.GetPatientAsync(id, tracking: true)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        _repository.ApplyOriginalRowVersion(patient, req.RowVersion);

        var phone = NormalizePhone(req.Phone);
        if (phone != patient.Phone && await _repository.PatientPhoneExistsAsync(phone, id))
            throw AppException.Conflict(Msg.PhoneTaken, "Số điện thoại này đã được dùng cho một hồ sơ khác.");
        if (phone != patient.Phone && await _repository.UserPhoneExistsAsync(phone, patient.UserId))
            throw AppException.Conflict(Msg.PhoneTaken, "Số điện thoại này đã được dùng cho tài khoản khác.");

        var before = new { patient.FullName, patient.Phone, patient.Address, patient.DiabetesType, patient.BaselineHbA1c };
        patient.FullName = req.FullName.Trim();
        patient.Gender = req.Gender;
        patient.DateOfBirth = req.DateOfBirth;
        patient.Phone = phone;
        patient.Address = req.Address;
        patient.DiabetesType = req.DiabetesType;
        patient.DiabetesDurationYears = req.DiabetesDurationYears;
        patient.BaselineHbA1c = req.BaselineHbA1c;
        patient.Note = req.Note;
        patient.UpdatedAt = DateTime.UtcNow;

        if (patient.UserId is int userId)
        {
            var user = await _repository.GetUserForUpdateAsync(userId);
            if (user is not null)
            {
                user.Phone = phone;
                user.FullName = patient.FullName;
                user.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _audit.LogAsync(
            AuditAction.PatientUpdate,
            nameof(Patient),
            patient.Id,
            before,
            new { patient.FullName, patient.Phone, patient.Address, patient.DiabetesType, patient.BaselineHbA1c });
        await _repository.CommitAsync();

        return Ok(await ToDetailAsync(patient));
    }

    public async Task<IActionResult> UpdateMine(UpdateMyProfileRequest req)
    {
        var patientId = RequireMyPatientId(_me);
        var patient = await _repository.GetPatientAsync(patientId, tracking: true)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        _repository.ApplyOriginalRowVersion(patient, req.RowVersion);

        var fullName = req.FullName.Trim();
        if (string.IsNullOrWhiteSpace(fullName))
            throw AppException.BadRequest(Msg.RequiredFields, "Họ tên không được để trống.");
        if (req.DateOfBirth > DateOnly.FromDateTime(_clock.LocalNow.Date))
            throw AppException.BadRequest(Msg.RequiredFields, "Ngày sinh không được nằm trong tương lai.");

        var before = new { patient.FullName, patient.Gender, patient.DateOfBirth, patient.Address };
        patient.FullName = fullName;
        patient.FullNameSearch = VietnameseText.RemoveDiacritics(fullName);
        patient.Gender = req.Gender;
        patient.DateOfBirth = req.DateOfBirth;
        patient.Address = string.IsNullOrWhiteSpace(req.Address) ? null : req.Address.Trim();
        patient.UpdatedAt = DateTime.UtcNow;

        if (patient.UserId is int userId)
        {
            var user = await _repository.GetUserForUpdateAsync(userId);
            if (user is not null)
            {
                user.FullName = fullName;
                user.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _audit.LogAsync(
            AuditAction.PatientUpdate,
            nameof(Patient),
            patient.Id,
            before,
            new { patient.FullName, patient.Gender, patient.DateOfBirth, patient.Address });
        await _repository.CommitAsync();

        return Ok(new { message = "Cập nhật thông tin cá nhân thành công.", rowVersion = patient.ToRowVersion() });
    }

    public async Task<IActionResult> RequestPhoneChangeOtp(RequestPhoneChangeOtpRequest req, IWebHostEnvironment env)
    {
        var patientId = RequireMyPatientId(_me);
        var patient = await _repository.GetPatientAsync(patientId)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        var newPhone = NormalizePhone(req.NewPhone);

        if (newPhone == patient.Phone)
            throw AppException.BadRequest(Msg.RequiredFields, "Số điện thoại mới phải khác số đang sử dụng.");

        await EnsurePhoneAvailableAsync(newPhone, patientId, patient.UserId);
        var code = await _otp.IssueAsync(newPhone, OtpPurpose.ChangePhone, patient.UserId);

        await _audit.LogAsync(
            AuditAction.OtpIssued,
            nameof(Patient),
            patient.Id,
            detail: $"Cấp OTP đổi số điện thoại sang {MaskPhone(newPhone)}");
        await _repository.CommitAsync();

        return Ok(new
        {
            message = "Mã xác minh đã được gửi tới số điện thoại mới.",
            devCode = env.IsDevelopment() ? code : null,
            note = env.IsDevelopment() ? "Mã chỉ được trả trực tiếp trong môi trường Development." : null
        });
    }

    public async Task<IActionResult> ConfirmPhoneChange(ConfirmPhoneChangeRequest req)
    {
        return await _repository.ExecuteInTransactionAsync<IActionResult>(async () =>
        {
            var patientId = RequireMyPatientId(_me);
            var patient = await _repository.GetPatientAsync(patientId, tracking: true)
                ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
            _repository.ApplyOriginalRowVersion(patient, req.RowVersion);

            var newPhone = NormalizePhone(req.NewPhone);
            if (newPhone == patient.Phone)
                throw AppException.BadRequest(Msg.RequiredFields, "Số điện thoại mới phải khác số đang sử dụng.");

            await EnsurePhoneAvailableAsync(newPhone, patientId, patient.UserId);
            if (!await _otp.VerifyAsync(newPhone, req.Code.Trim(), OtpPurpose.ChangePhone))
                throw AppException.BadRequest(Msg.OtpInvalid, "Mã xác minh không đúng hoặc đã hết hạn.");

            var oldPhone = patient.Phone;
            patient.Phone = newPhone;
            patient.UpdatedAt = DateTime.UtcNow;

            if (patient.UserId is int userId)
            {
                var user = await _repository.GetUserForUpdateAsync(userId)
                    ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy tài khoản liên kết với bệnh nhân.");
                user.Phone = newPhone;
                user.UpdatedAt = DateTime.UtcNow;
            }

            await _audit.LogAsync(
                AuditAction.PatientPhoneChange,
                nameof(Patient),
                patient.Id,
                new { Phone = MaskPhone(oldPhone) },
                new { Phone = MaskPhone(newPhone) });
            await _repository.CommitAsync();

            return Ok(new
            {
                message = "Đổi số điện thoại thành công. Từ lần đăng nhập sau, hãy dùng số mới.",
                phone = newPhone,
                rowVersion = patient.ToRowVersion()
            });
        });
    }

    public async Task<ActionResult<TempCredentialResponse>> ReissueCredentials(int id)
    {
        var patient = await _repository.GetPatientAsync(id, tracking: true)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        var temp = _hasher.GenerateTempPassword();

        await _repository.ExecuteInTransactionAsync(async () =>
        {
            User user;
            if (patient.UserId is int userId)
            {
                user = await _repository.GetUserForUpdateAsync(userId)
                    ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy tài khoản liên kết với bệnh nhân.");
                user.PasswordHash = _hasher.Hash(temp);
                user.MustChangePassword = true;
                user.Phone = patient.Phone;
                user.FullName = patient.FullName;
                user.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                if (await _repository.UserPhoneExistsAsync(patient.Phone))
                    throw AppException.Conflict(Msg.PhoneTaken, "Số điện thoại này đã được dùng cho tài khoản khác.");

                user = new User
                {
                    Phone = patient.Phone,
                    PasswordHash = _hasher.Hash(temp),
                    FullName = patient.FullName,
                    MustChangePassword = true
                };
                _repository.Add(user);
                await _repository.CommitAsync();
                patient.UserId = user.Id;
            }

            if (!await _repository.EnsureUserRoleActiveAsync(user, Roles.Patient, _me.RequireId()))
                throw AppException.Conflict(Msg.RequiredFields, "Vai trò Patient chưa tồn tại hoặc đang bị khóa trong cơ sở dữ liệu.");

            await _audit.LogAsync(AuditAction.PasswordReset, nameof(Patient), patient.Id,
                detail: "Cấp lại mật khẩu tạm tại quầy");
            await _repository.CommitAsync();
        });

        return Ok(new TempCredentialResponse
        {
            LoginId = patient.Phone,
            TempPassword = temp,
            Note = "Mật khẩu tạm chỉ hiển thị một lần. Bệnh nhân phải đổi ở lần đăng nhập đầu.",
            RowVersion = patient.ToRowVersion()
        });
    }

    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        await _void.VoidPatientAsync(id, req.Reason, req.RowVersion);
        return Ok(new { message = "Đã thu hồi hồ sơ bệnh nhân." });
    }

    private async Task EnsurePhoneAvailableAsync(string phone, int patientId, int? userId)
    {
        if (await _repository.PatientPhoneExistsAsync(phone, patientId))
            throw AppException.Conflict(Msg.PhoneTaken, "Số điện thoại này đã được dùng cho một hồ sơ bệnh nhân khác.");
        if (await _repository.UserPhoneExistsAsync(phone, userId))
            throw AppException.Conflict(Msg.PhoneTaken, "Số điện thoại này đã được dùng cho tài khoản khác.");
    }

    private async Task<string> NextCodeAsync()
    {
        var prefix = $"BN{_clock.LocalToday.Year}";
        var last = await _repository.GetLastPatientCodeAsync(prefix);
        var sequence = last is null ? 1 : int.Parse(last[prefix.Length..]) + 1;
        return $"{prefix}{sequence:D4}";
    }

    private async Task<PatientDetailDto> ToDetailAsync(Patient patient)
    {
        var stats = await _repository.GetPatientDetailStatsAsync(patient.Id);
        var today = _clock.LocalToday;
        return new PatientDetailDto
        {
            Id = patient.Id,
            Code = patient.Code,
            FullName = patient.FullName,
            Age = today.Year - patient.DateOfBirth.Year,
            Gender = patient.Gender,
            Phone = patient.Phone,
            Address = patient.Address,
            DateOfBirth = patient.DateOfBirth,
            DiabetesType = patient.DiabetesType,
            DiabetesDurationYears = patient.DiabetesDurationYears,
            BaselineHbA1c = patient.BaselineHbA1c,
            Note = patient.Note,
            CreatedAt = patient.CreatedAt,
            HasAccount = patient.UserId != null,
            LatestDrGrade = stats.LatestDrGrade,
            DoctorInCharge = stats.DoctorInCharge,
            VisitCount = stats.VisitCount,
            RowVersion = patient.ToRowVersion()
        };
    }

    private static string NormalizePhone(string value)
    {
        var phone = value.Trim().Replace(" ", "").Replace("-", "");
        if (phone.Length < 9 || phone.Length > 20 || phone.Any(c => !char.IsDigit(c) && c != '+'))
            throw AppException.BadRequest(Msg.RequiredFields, "Số điện thoại không đúng định dạng.");
        return phone;
    }

    private static string MaskPhone(string phone)
    {
        if (phone.Length <= 4) return new string('*', phone.Length);
        return new string('*', phone.Length - 4) + phone[^4..];
    }
}
