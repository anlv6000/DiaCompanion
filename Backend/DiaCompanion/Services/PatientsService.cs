using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-12..17 — hồ sơ bệnh nhân, kèm cấp tài khoản lúc tạo hồ sơ.</summary>
public class PatientsService : BaseService, IPatientsService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IAuditService _audit;
    private readonly IPasswordHasher _hasher;
    private readonly IVoidService _void;
    private readonly IClinicClock _clock;

    public PatientsService(IRepository repository, ICurrentUser me, IAuditService audit,
                              IPasswordHasher hasher, IVoidService voidSvc, IClinicClock clock)
    { _repository = repository; _me = me; _audit = audit; _hasher = hasher; _void = voidSvc; _clock = clock; }

    /// <summary>
    /// UC-12 — tìm kiếm và lọc, phân trang offset (QT-14).
    /// Tìm bỏ dấu: "nguyen van an" khớp "Nguyễn Văn Ấn" (QT-15).
    /// </summary>
    public async Task<ActionResult<PagedResult<PatientListItemDto>>> Search(
        [FromQuery] string? q,
        [FromQuery] byte? diabetesType,
        [FromQuery] byte? grade,
        [FromQuery] PageQuery page)
    {
        var query = _repository.Patients.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q))
        {
            // INTERACTION.md: không truy vấn khi từ khoá quá ngắn — debounce phía
            // client chỉ giảm request của MỘT người, không chặn 20 người cùng gõ.
            if (q.Trim().Length < 2)
                throw AppException.BadRequest(Msg.RequiredFields, "Vui lòng nhập tối thiểu 2 ký tự để tìm kiếm.");

            var norm = VietnameseText.RemoveDiacritics(q);
            query = query.Where(p =>
                EF.Functions.Like(p.FullNameSearch!, $"%{norm}%") ||
                EF.Functions.Like(p.Code, $"%{q}%") ||
                EF.Functions.Like(p.Phone, $"%{q}%"));
        }

        if (diabetesType is byte dt) query = query.Where(p => p.DiabetesType == dt);

        // Mức DR gần nhất ĐÃ XÁC NHẬN, lấy MẮT NẶNG HƠN (BR-21).
        // Chỉ tính review của bác sĩ, không tính kết quả AI chưa duyệt (BR-13).
        var gradeByPatient = _repository.DiagnosisReviews.AsNoTracking()
            .Select(r => new
            {
                PatientId = r.AiDiagnosis!.FundusImage!.PatientId,
                Grade = (byte)r.FinalGrade,
                r.CreatedAt
            })
            .GroupBy(x => x.PatientId)
            .Select(g => new
            {
                PatientId = g.Key,
                MaxGrade = (byte?)g.Max(x => x.Grade),
                LastAt = (DateTime?)g.Max(x => x.CreatedAt)
            });

        if (grade is byte gr)
            query = query.Where(p => gradeByPatient.Any(l => l.PatientId == p.Id && l.MaxGrade == gr));

        var total = await query.CountAsync();

        query = (page.Sort, page.Desc) switch
        {
            ("name", false) => query.OrderBy(p => p.FullName),
            ("name", true) => query.OrderByDescending(p => p.FullName),
            ("code", false) => query.OrderBy(p => p.Code),
            ("code", true) => query.OrderByDescending(p => p.Code),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        var today = _clock.LocalToday;

        // Lấy trang bệnh nhân trước, rồi nạp mức DR bằng MỘT truy vấn thứ hai.
        // Nhét truy vấn con tương quan vào Select sẽ sinh ra một subquery cho
        // mỗi dòng — chậm và dễ vỡ khi EF không dịch được.
        var rows = await query.Skip(page.Skip).Take(page.PageSize)
            .Select(p => new
            {
                p.Id,
                p.Code,
                p.FullName,
                p.Gender,
                p.Phone,
                p.DateOfBirth,
                p.DiabetesType,
                p.DiabetesDurationYears,
                HasAccount = p.UserId != null
            }).ToListAsync();

        var pageIds = rows.Select(r => r.Id).ToList();
        var grades = await gradeByPatient
            .Where(g => pageIds.Contains(g.PatientId))
            .ToDictionaryAsync(g => g.PatientId, g => new { g.MaxGrade, g.LastAt });

        var items = rows.Select(r => new PatientListItemDto
        {
            Id = r.Id,
            Code = r.Code,
            FullName = r.FullName,
            Age = today.Year - r.DateOfBirth.Year,
            Gender = r.Gender,
            Phone = r.Phone,
            DiabetesType = r.DiabetesType,
            DiabetesDurationYears = r.DiabetesDurationYears,
            LatestDrGrade = grades.TryGetValue(r.Id, out var g1) ? g1.MaxGrade : null,
            LatestVisitDate = grades.TryGetValue(r.Id, out var g2) ? g2.LastAt : null,
            HasAccount = r.HasAccount
        }).ToList();

        return Ok(new PagedResult<PatientListItemDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }

    /// <summary>UC-13 — chi tiết hồ sơ.</summary>
    public async Task<ActionResult<PatientDetailDto>> Get(int id)
    {
        var p = await _repository.Patients.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");
        return Ok(await ToDetailAsync(p));
    }

    /// <summary>UC-16 — bệnh nhân xem hồ sơ của chính mình.</summary>
    public async Task<ActionResult<PatientDetailDto>> GetMine()
    {
        var pid = RequireMyPatientId(_me);
        var p = await _repository.Patients.AsNoTracking().FirstAsync(x => x.Id == pid);
        return Ok(await ToDetailAsync(p));
    }

    /// <summary>
    /// UC-14 — tạo hồ sơ VÀ cấp tài khoản trong cùng một thao tác.
    ///
    /// Thay cho luồng cũ (bệnh nhân tự đăng ký rồi nhập mã liên kết): phòng khám
    /// tạo cả hai cùng lúc nên tài khoản gắn hồ sơ ngay từ đầu, loại bỏ hoàn toàn
    /// bài toán liên kết nhầm hồ sơ.
    /// </summary>
    public async Task<ActionResult<CreatePatientResponse>> Create(CreatePatientRequest req)
    {
        var phone = req.Phone.Trim();

        if (await _repository.Patients.AnyAsync(p => p.Phone == phone))
        {
            throw AppException.Conflict(
                Msg.PhoneTaken,
                "Số điện thoại này đã được dùng cho một hồ sơ khác. " +
                "Mỗi bệnh nhân cần một số riêng vì đây là định danh đăng nhập.");
        }

        if (req.CreateAccount &&
            await _repository.Users.AnyAsync(
                u => u.Phone == phone && u.IsActive))
        {
            throw AppException.Conflict(
                Msg.PhoneTaken,
                "Số điện thoại này đã có tài khoản đang hoạt động.");
        }

        if (req.BaselineHbA1c is decimal hba1c &&
    (hba1c < 3 || hba1c > 20))
        {
            throw AppException.BadRequest(
                Msg.RequiredFields,
                "HbA1c ban đầu phải nằm trong khoảng từ 3% đến 20%.");
        }

        var strategy =
            _repository.Database.CreateExecutionStrategy();

        CreatePatientResponse? response = null;

        await strategy.ExecuteAsync(async () =>
        {
            await using var tx =
                await _repository.Database.BeginTransactionAsync();

            try
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

                TempCredentialResponse? cred = null;

                if (req.CreateAccount)
                {
                    var temp = _hasher.GenerateTempPassword();

                    var user = new User
                    {
                        Phone = phone,
                        PasswordHash = _hasher.Hash(temp),
                        Role = UserRole.Patient,
                        FullName = patient.FullName,
                        MustChangePassword = true,
                        IsActive = true
                    };

                    _repository.Users.Add(user);
                    await _repository.SaveChangesAsync();

                    patient.UserId = user.Id;

                    cred = new TempCredentialResponse
                    {
                        LoginId = phone,
                        TempPassword = temp,
                        Note =
                            "Mật khẩu tạm chỉ hiển thị một lần. " +
                            "In cho bệnh nhân; hệ thống sẽ bắt đổi mật khẩu " +
                            "ở lần đăng nhập đầu tiên."
                    };
                }

                _repository.Patients.Add(patient);
                await _repository.SaveChangesAsync();

                await _audit.LogAsync(
                    AuditAction.PatientCreate,
                    nameof(Patient),
                    patient.Id,
                    null,
                    new
                    {
                        patient.Code,
                        patient.FullName,
                        patient.Phone,
                        hasAccount = req.CreateAccount
                    });

                await _repository.SaveChangesAsync();
                await tx.CommitAsync();

                response = new CreatePatientResponse
                {
                    Patient = await ToDetailAsync(patient),
                    Account = cred
                };
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        });

        return CreatedAtAction(
            nameof(Get),
            new { id = response!.Patient.Id },
            response);
    }

    /// <summary>
    /// UC-15 — cập nhật hồ sơ theo phạm vi vai trò.
    /// Receptionist chỉ sửa thông tin hành chính; Doctor chỉ sửa thông tin lâm sàng.
    /// </summary>
    public async Task<ActionResult<PatientDetailDto>> Update(int id, UpdatePatientRequest req)
    {
        var p = await _repository.Patients.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");

        _repository.ApplyOriginalRowVersion(p, req.RowVersion);

        if (_me.Role == UserRole.Receptionist)
        {
            var phone = req.Phone.Trim();
            if (phone != p.Phone &&
                await _repository.Patients.AnyAsync(x => x.Phone == phone && x.Id != id))
            {
                throw AppException.Conflict(
                    Msg.PhoneTaken,
                    "Số điện thoại này đã được dùng cho một hồ sơ khác.");
            }

            var before = new { p.FullName, p.Gender, p.DateOfBirth, p.Phone, p.Address };

            p.FullName = req.FullName.Trim();
            p.Gender = req.Gender;
            p.DateOfBirth = req.DateOfBirth;
            p.Phone = phone;
            p.Address = req.Address;
            p.UpdatedAt = DateTime.UtcNow;

            // Số điện thoại là định danh đăng nhập nên tài khoản phải cập nhật đồng bộ.
            if (p.UserId is int uid)
            {
                var u = await _repository.Users.FirstOrDefaultAsync(x => x.Id == uid);
                if (u is not null)
                {
                    u.Phone = phone;
                    u.FullName = p.FullName;
                    u.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _audit.LogAsync(
                AuditAction.PatientUpdate,
                nameof(Patient),
                p.Id,
                before,
                new { p.FullName, p.Gender, p.DateOfBirth, p.Phone, p.Address, Scope = "Administrative" });
        }
        else if (_me.Role == UserRole.Doctor)
        {
            if (req.BaselineHbA1c is decimal hba1c && (hba1c < 3 || hba1c > 20))
            {
                throw AppException.BadRequest(
                    Msg.RequiredFields,
                    "HbA1c ban đầu phải nằm trong khoảng từ 3% đến 20%.");
            }

            var before = new
            {
                p.DiabetesType,
                p.DiabetesDurationYears,
                p.BaselineHbA1c,
                p.Note
            };

            p.DiabetesType = req.DiabetesType;
            p.DiabetesDurationYears = req.DiabetesDurationYears;
            p.BaselineHbA1c = req.BaselineHbA1c;
            p.Note = req.Note;
            p.UpdatedAt = DateTime.UtcNow;

            await _audit.LogAsync(
                AuditAction.PatientUpdate,
                nameof(Patient),
                p.Id,
                before,
                new
                {
                    p.DiabetesType,
                    p.DiabetesDurationYears,
                    p.BaselineHbA1c,
                    p.Note,
                    Scope = "Clinical"
                });
        }
        else
        {
            throw AppException.Forbidden(
                Msg.Forbidden,
                "Vai trò hiện tại không được cập nhật hồ sơ bệnh nhân.");
        }

        await _repository.SaveChangesAsync();
        return Ok(await ToDetailAsync(p));
    }

    /// <summary>UC-17 — bệnh nhân tự cập nhật thông tin liên hệ.</summary>
    public async Task<IActionResult> UpdateMine(UpdateMyProfileRequest req)
    {
        var pid = RequireMyPatientId(_me);
        var p = await _repository.Patients.FirstAsync(x => x.Id == pid);
        _repository.ApplyOriginalRowVersion(p, req.RowVersion);

        var requestedPhone = req.Phone.Trim();

        if (await _repository.Patients.AnyAsync(x => x.Phone == requestedPhone && x.Id != pid))
        {
            throw AppException.Conflict(
                Msg.PhoneTaken,
                "Số điện thoại này đã được dùng cho một hồ sơ khác. " +
                "Mỗi bệnh nhân cần một số riêng vì đây là định danh đăng nhập.");
        }

        if (
            await _repository.Users.AnyAsync(
                u => u.Phone == requestedPhone && u.IsActive && u.Id != p.UserId))
        {
            throw AppException.Conflict(
                Msg.PhoneTaken,
                "Số điện thoại này đã có tài khoản đang hoạt động.");
        }

        if (req.BaselineHbA1c is decimal hba1c &&
    (hba1c < 3 || hba1c > 20))
        {
            throw AppException.BadRequest(
                Msg.RequiredFields,
                "HbA1c ban đầu phải nằm trong khoảng từ 3% đến 20%.");
        }

        var phone = requestedPhone;

        var before = new { p.FullName, p.Phone, p.Address, p.DiabetesType, p.BaselineHbA1c };

        p.FullName = req.FullName.Trim();
        p.Gender = req.Gender;
        p.DateOfBirth = req.DateOfBirth;
        p.Phone = phone;
        p.Address = req.Address;
        p.DiabetesType = req.DiabetesType;
        p.DiabetesDurationYears = req.DiabetesDurationYears;
        p.BaselineHbA1c = req.BaselineHbA1c;
        p.UpdatedAt = DateTime.UtcNow;

        // Tài khoản đăng nhập phải đi theo, nếu không bệnh nhân đổi số xong
        // sẽ không đăng nhập được nữa.
        if (p.UserId is int uid)
        {
            var u = await _repository.Users.FirstOrDefaultAsync(x => x.Id == uid);
            if (u is not null) { u.Phone = phone; u.FullName = p.FullName; u.UpdatedAt = DateTime.UtcNow; }
        }

        await _audit.LogAsync(AuditAction.PatientUpdate, nameof(Patient), p.Id, before,
          new { p.FullName, p.Phone, p.Address, p.DiabetesType, p.BaselineHbA1c });
        await _repository.SaveChangesAsync();
        return Ok(new
        {
            message = "Cập nhật thông tin thành công.",
            rowVersion = p.ToRowVersion()
        });
    }

    /// <summary>
    /// Cấp lại mật khẩu tạm tại quầy — thay cho luồng liên kết tài khoản cũ.
    /// Dùng khi bệnh nhân quên mật khẩu và không nhận được OTP.
    /// người dùng khi được tạo 
    /// </summary>
    public async Task<ActionResult<TempCredentialResponse>> ReissueCredentials(int id)
    {
        var p = await _repository.Patients.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.PatientNotFound, "Không tìm thấy hồ sơ bệnh nhân.");

        var temp = _hasher.GenerateTempPassword();

        if (p.UserId is int uid)
        {
            var u = await _repository.Users.FirstAsync(x => x.Id == uid);
            u.PasswordHash = _hasher.Hash(temp);
            u.MustChangePassword = true;
            u.IsActive = true;
            u.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            var u = new User
            {
                Phone = p.Phone,
                PasswordHash = _hasher.Hash(temp),
                Role = UserRole.Patient,
                FullName = p.FullName,
                MustChangePassword = true
            };
            _repository.Users.Add(u);
            await _repository.SaveChangesAsync();
            p.UserId = u.Id;
        }

        await _audit.LogAsync(AuditAction.PasswordReset, nameof(Patient), p.Id,
            detail: "Cấp lại mật khẩu tạm tại quầy");
        await _repository.SaveChangesAsync();

        return Ok(new TempCredentialResponse
        {
            LoginId = p.Phone,
            TempPassword = temp,
            Note = "Mật khẩu tạm chỉ hiển thị một lần. Bệnh nhân phải đổi ở lần đăng nhập đầu."
        });
    }

    /// <summary>
    /// Thu hồi hồ sơ nhập nhầm hoặc trùng.
    /// Nhờ filtered unique index, số điện thoại được giải phóng để đăng ký lại.
    /// </summary>
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        await _void.VoidPatientAsync(id, req.Reason, req.RowVersion);
        return Ok(new { message = "Đã thu hồi hồ sơ bệnh nhân." });
    }

    private async Task<string> NextCodeAsync()
    {
        var year = _clock.LocalToday.Year;
        var prefix = $"BN{year}";
        // IgnoreQueryFilters: hồ sơ đã void vẫn chiếm mã, không được cấp lại
        var last = await _repository.Patients.IgnoreQueryFilters()
            .Where(p => p.Code.StartsWith(prefix))
            .OrderByDescending(p => p.Code).Select(p => p.Code).FirstOrDefaultAsync();

        var seq = last is null ? 1 : int.Parse(last[prefix.Length..]) + 1;
        return $"{prefix}{seq:D4}";
    }

    private async Task<PatientDetailDto> ToDetailAsync(Patient p)
    {
        var today = _clock.LocalToday;

        // "Bác sĩ phụ trách" = bác sĩ của lượt khám gần nhất.
        // Định nghĩa như vậy vì mô hình phòng khám sàng lọc không phân bác sĩ cố định,
        // và bảng Patients cố ý không có cột DoctorId.
        var lastVisit = await _repository.Visits.AsNoTracking()
            .Where(v => v.PatientId == p.Id)
            .OrderByDescending(v => v.VisitDate)
            .Select(v => new { v.DoctorId, DoctorName = v.Doctor!.FullName })
            .FirstOrDefaultAsync();

        var latestGrade = await _repository.DiagnosisReviews.AsNoTracking()
            .Join(_repository.AiDiagnoses, r => r.AiDiagnosisId, d => d.Id, (r, d) => new { r, d })
            .Join(_repository.FundusImages, x => x.d.FundusImageId, f => f.Id, (x, f) => new { x.r, f })
            .Where(x => x.f.PatientId == p.Id)
            .OrderByDescending(x => x.r.CreatedAt)
            .Select(x => (byte?)(byte)x.r.FinalGrade)
            .FirstOrDefaultAsync();

        return new PatientDetailDto
        {
            Id = p.Id,
            Code = p.Code,
            FullName = p.FullName,
            Age = today.Year - p.DateOfBirth.Year,
            Gender = p.Gender,
            Phone = p.Phone,
            Address = p.Address,
            DateOfBirth = p.DateOfBirth,
            DiabetesType = p.DiabetesType,
            DiabetesDurationYears = p.DiabetesDurationYears,
            BaselineHbA1c = p.BaselineHbA1c,
            Note = p.Note,
            CreatedAt = p.CreatedAt,
            HasAccount = p.UserId != null,
            LatestDrGrade = latestGrade,
            DoctorInCharge = lastVisit?.DoctorName,
            VisitCount = await _repository.Visits.CountAsync(v => v.PatientId == p.Id),
            RowVersion = p.ToRowVersion()
        };
    }
}
