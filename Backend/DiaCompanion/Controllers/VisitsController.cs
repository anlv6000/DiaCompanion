using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-18..21 — lượt khám.</summary>
public class VisitsController : BaseApiController
{
    private readonly IVisitsService _service;

    public VisitsController(IVisitsService service) => _service = service;


    /// <summary>Danh sách lượt khám của một bệnh nhân.</summary>
    [HttpGet]
    [Authorize(Roles = Roles.Staff)]
    public async Task<ActionResult<PagedResult<VisitDto>>> List(
    [FromQuery] int? patientId, [FromQuery] byte? status, [FromQuery] PageQuery page)
    {
        return await _service.List(patientId, status, page);
    }


    /// <summary>UC-19 — chi tiết lượt khám kèm ảnh, kết quả AI và review.</summary>
    [HttpGet("{id:int}")]
    [Authorize(Roles = Roles.Staff)]
    public async Task<ActionResult<VisitDto>> Get(int id)
    {
        return await _service.Get(id);
    }


    /// <summary>UC-18 — tạo lượt khám.</summary>
    [HttpPost]
    [Authorize(Roles = Roles.Doctor)]
    public async Task<ActionResult<VisitDto>> Create(CreateVisitRequest req)
    {
        return await _service.Create(req);
    }


    /// <summary>
    /// UC-20 — nhập kết luận và đóng lượt khám.
    /// BR-12: bắt buộc có kết luận. BR-19: chu kỳ tái khám suy từ mức DR đã xác nhận.
    /// </summary>
    [HttpPut("{id:int}/close")]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<ActionResult<VisitDto>> Close(int id, CloseVisitRequest req)
    {
        return await _service.Close(id, req);
    }


    /// <summary>UC-21 — thu hồi lượt khám (lan sang ảnh, kết quả AI, review, đơn thuốc).</summary>
    [HttpPut("{id:int}/void")]
    [Authorize(Roles = Roles.DoctorOnly)]
    public async Task<IActionResult> Void(int id, VoidRequest req)
    {
        return await _service.Void(id, req);
    }
}
