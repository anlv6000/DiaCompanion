using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-36..40 — đơn thuốc và tuân thủ.</summary>
public class PrescriptionsController : BaseApiController
{
    private readonly IPrescriptionsService _service;

    public PrescriptionsController(IPrescriptionsService service) => _service = service;


    /// <summary>UC-40 — lịch sử đơn thuốc.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<PrescriptionDto>>> List(
    [FromQuery] int? patientId, [FromQuery] PageQuery page)
    {
        return await _service.List(patientId, page);
    }


    /// <summary>UC-37 — chi tiết đơn thuốc.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PrescriptionDto>> Get(int id)
    {
        return await _service.Get(id);
    }


    /// <summary>UC-36 — kê đơn. Sinh luôn lịch nhắc uống thuốc cho ứng dụng bệnh nhân.</summary>
    [HttpPost]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<ActionResult<PrescriptionDto>> Create(CreatePrescriptionRequest req)
    {
        return await _service.Create(req);
    }


    /// <summary>
    /// UC-38 — sửa đơn thuốc.
    /// Sinh lại lịch nhắc cho các liều CHƯA tới hạn; liều đã xác nhận giữ nguyên
    /// vì đó là sự kiện đã xảy ra ngoài đời.
    /// </summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<ActionResult<PrescriptionDto>> Update(int id, CreatePrescriptionRequest req)
    {
        return await _service.Update(id, req);
    }


    /// <summary>UC-39 — thu hồi đơn thuốc.</summary>
    [HttpPut("{id:int}/void")]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        return await _service.Void(id, req);
    }


    /// <summary>UC-50 — tỉ lệ tuân thủ thuốc (bác sĩ và bệnh nhân cùng xem).</summary>
    [HttpGet("adherence/{patientId:int}")]
    public async Task<IActionResult> Adherence(int patientId, [FromQuery] int days = 30)
    {
        return await _service.Adherence(patientId, days);
    }
}
