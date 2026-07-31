using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-58, UC-63..66 — quản trị hệ thống.</summary>
[Route("api/admin")]
[Authorize(Roles = Roles.Admin)]
public class AdminController : BaseApiController
{
    private readonly IAdminService _service;

    public AdminController(IAdminService service) => _service = service;


    /* ----------------------------- UC-58 DASHBOARD ----------------------- */

    [HttpGet("dashboard")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<ActionResult<DashboardDto>> Dashboard()
    {
        return await _service.Dashboard();
    }


    /* --------------------------- UC-63 CẤU HÌNH ------------------------- */

    [HttpGet("configs")]
    public async Task<ActionResult<List<SystemConfigDto>>> Configs()
    {
        return await _service.Configs();
    }


    /// <summary>
    /// UC-63 — đổi ngưỡng.
    /// Giá trị mới CHỈ áp dụng cho các ca chạy SAU thời điểm này; kết quả đã lưu
    /// giữ nguyên ngưỡng tại thời điểm chạy (A1 của UC-28, BR-17).
    /// </summary>
    [HttpPut("configs/{key}")]
    public async Task<IActionResult> UpdateConfig(string key, UpdateConfigRequest req)
    {
        return await _service.UpdateConfig(key, req);
    }


    /// <summary>
    /// UC-63 bước 4 — ước tính ảnh hưởng TRƯỚC khi đổi ngưỡng.
    ///
    /// Đây là điểm cân bằng giữa mức tự động và mức an toàn: hạ ngưỡng thì ít ca
    /// chuyển bác sĩ hơn (nhanh hơn nhưng rủi ro hơn), nâng ngưỡng thì ngược lại.
    /// Admin cần thấy con số trước khi quyết định.
    /// </summary>
    [HttpGet("configs/threshold-impact")]
    public async Task<ActionResult<ThresholdImpactDto>> ThresholdImpact(
    [FromQuery] string key, [FromQuery] decimal proposed)
    {
        return await _service.ThresholdImpact(key, proposed);
    }


    /* --------------------------- UC-64, 65 MODEL ------------------------ */

    [HttpGet("models")]
    public async Task<ActionResult<List<ModelVersionDto>>> Models()
    {
        return await _service.Models();
    }


    /// <summary>UC-64 — đăng ký phiên bản mới.</summary>
    [HttpPost("models")]
    public async Task<ActionResult<ModelVersionDto>> RegisterModel(RegisterModelRequest req)
    {
        return await _service.RegisterModel(req);
    }


    /// <summary>
    /// UC-64 — kích hoạt phiên bản.
    /// BR-15: chỉ một phiên bản kích hoạt tại một thời điểm.
    /// </summary>
    [HttpPut("models/{id:int}/activate")]
    public async Task<IActionResult> ActivateModel(int id)
    {
        return await _service.ActivateModel(id);
    }


    /// <summary>UC-65 — xoá phiên bản CHƯA TỪNG kích hoạt (BR-16).</summary>
    [HttpDelete("models/{id:int}")]
    public async Task<IActionResult> DeleteModel(int id)
    {
        return await _service.DeleteModel(id);
    }


    /* ---------------------------- UC-66 AUDIT --------------------------- */

    /// <summary>
    /// UC-66 — nhật ký audit, KEYSET pagination.
    ///
    /// Bảng này lớn nhất và được lật sâu nhất, mà OFFSET phải quét bỏ n dòng
    /// đầu nên trang sâu rất chậm. Cũng cố ý KHÔNG trả tổng số: COUNT(*) trên
    /// bảng hàng triệu dòng thường tốn hơn chính câu lấy trang.
    /// </summary>
    [HttpGet("audit")]
    public async Task<ActionResult<KeysetResult<AuditLogDto>>> Audit(
    [FromQuery] string? action, [FromQuery] string? entityType, [FromQuery] int? entityId,
    [FromQuery] int? userId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
    [FromQuery] string? cursor, [FromQuery] int size = 25)
    {
        return await _service.Audit(action, entityType, entityId, userId, from, to, cursor, size);
    }
}
