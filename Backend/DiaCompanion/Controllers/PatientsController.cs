using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-12..17 — hồ sơ bệnh nhân, kèm cấp tài khoản lúc tạo hồ sơ.</summary>
public class PatientsController : BaseApiController
{
    private readonly IPatientsService _service;

    public PatientsController(IPatientsService service) => _service = service;


    /// <summary>
    /// UC-12 — tìm kiếm và lọc, phân trang offset (QT-14).
    /// Tìm bỏ dấu: "nguyen van an" khớp "Nguyễn Văn Ấn" (QT-15).
    /// </summary>
    [HttpGet]
    [Authorize(Roles = Roles.DoctorOrReception)]
    public async Task<ActionResult<PagedResult<PatientListItemDto>>> Search(
    [FromQuery] string? q,
    [FromQuery] byte? diabetesType,
    [FromQuery] byte? grade,
    [FromQuery] PageQuery page)
    {
        return await _service.Search(q, diabetesType, grade, page);
    }


    /// <summary>UC-13 — chi tiết hồ sơ.</summary>
    [HttpGet("{id:int}")]
    [Authorize(Roles = Roles.DoctorOrReception)]
    public async Task<ActionResult<PatientDetailDto>> Get(int id)
    {
        return await _service.Get(id);
    }


    /// <summary>UC-16 — bệnh nhân xem hồ sơ của chính mình.</summary>
    [HttpGet("me")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<PatientDetailDto>> GetMine()
    {
        return await _service.GetMine();
    }


    /// <summary>
    /// UC-14 — tạo hồ sơ VÀ cấp tài khoản trong cùng một thao tác.
    ///
    /// Thay cho luồng cũ (bệnh nhân tự đăng ký rồi nhập mã liên kết): phòng khám
    /// tạo cả hai cùng lúc nên tài khoản gắn hồ sơ ngay từ đầu, loại bỏ hoàn toàn
    /// bài toán liên kết nhầm hồ sơ.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = Roles.Receptionist)]
    public async Task<ActionResult<CreatePatientResponse>> Create(CreatePatientRequest req)
    {
        return await _service.Create(req);
    }


    /// <summary>UC-15 — cập nhật hồ sơ.</summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.StaffPatient)]
    public async Task<ActionResult<PatientDetailDto>> Update(int id, UpdatePatientRequest req)
    {
        return await _service.Update(id, req);
    }


    /// <summary>UC-17 — bệnh nhân tự cập nhật thông tin liên hệ.</summary>
    [HttpPut("me")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<IActionResult> UpdateMine(UpdateMyProfileRequest req)
    {
        return await _service.UpdateMine(req);
    }


    /// <summary>
    /// Cấp lại mật khẩu tạm tại quầy — thay cho luồng liên kết tài khoản cũ.
    /// Dùng khi bệnh nhân quên mật khẩu và không nhận được OTP.
    /// </summary>
    [HttpPost("{id:int}/reissue-credentials")]
    [Authorize(Roles = Roles.FrontDeskOrAdmin)]
    public async Task<ActionResult<TempCredentialResponse>> ReissueCredentials(int id)
    {
        return await _service.ReissueCredentials(id);
    }

    /// <summary>
    /// Thu hồi hồ sơ nhập nhầm hoặc trùng.
    /// Nhờ filtered unique index, số điện thoại được giải phóng để đăng ký lại.
    /// </summary>
    [HttpPut("{id:int}/void")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        return await _service.Void(id, req);
    }
}
