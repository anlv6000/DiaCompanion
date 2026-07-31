using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>
/// UC-41, UC-42 — nhắc tái tầm soát.
///
/// Thay cho chức năng đặt lịch theo khung giờ đã bỏ. Ngày tái khám được TÍNH
/// từ lượt khám hoàn tất gần nhất (ClosedAt + RecheckMonths, BR-19), không lưu
/// trong bảng riêng và không có trạng thái đặt/hủy/đổi.
///
/// Bệnh nhân đến khám trực tiếp trong giờ làm việc.
/// </summary>
[Route("api/recheck")]
public class RecheckController : BaseApiController
{
    private readonly IRecheckService _service;

    public RecheckController(IRecheckService service) => _service = service;


    /// <summary>UC-41 — bệnh nhân xem lần tái khám tiếp theo của mình.</summary>
    [HttpGet("me")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<RecheckDto>> Mine()
    {
        return await _service.Mine();
    }


    /// <summary>Xem ngày tái khám của một bệnh nhân cụ thể (phía phòng khám).</summary>
    [HttpGet("patient/{patientId:int}")]
    [Authorize(Roles = Roles.Staff)]
    public async Task<ActionResult<RecheckDto>> ForPatient(int patientId)
    {
        return await _service.ForPatient(patientId);
    }


    /// <summary>
    /// UC-42 — danh sách bệnh nhân đến hạn tái tầm soát, để phòng khám gọi nhắc.
    ///
    /// Toàn bộ tính từ dữ liệu lượt khám, không có bảng lịch hẹn. Bệnh nhân
    /// được coi là chưa quay lại khi chưa có lượt khám nào mới hơn lượt đã đóng.
    /// </summary>
    [HttpGet("due")]
    [Authorize(Roles = Roles.FrontDesk)]
    public async Task<ActionResult<PagedResult<RecheckDto>>> Due(
    [FromQuery] bool overdueOnly = false,
    [FromQuery] int withinDays = 30,
    [FromQuery] PageQuery? page = null)
    {
        return await _service.Due(overdueOnly, withinDays, page);
    }


    /// <summary>Số bệnh nhân quá hạn, để hiện badge trên thanh điều hướng.</summary>
    [HttpGet("overdue-count")]
    [Authorize(Roles = Roles.Staff)]
    public async Task<IActionResult> OverdueCount()
    {
        return await _service.OverdueCount();
    }
}
