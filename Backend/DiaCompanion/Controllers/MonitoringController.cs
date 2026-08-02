using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>
/// UC-46..52 — theo dõi yếu tố nguy cơ của bệnh gốc.
/// Đây là dữ liệu bệnh nhân tự nhập nên dùng SOFT DELETE, không phải void.
/// </summary>
[Route("api/monitoring")]
public class MonitoringController : BaseApiController
{
    private readonly IMonitoringService _service;

    public MonitoringController(IMonitoringService service) => _service = service;


    /* ------------------------------ CHỈ SỐ ------------------------------ */

    /// <summary>UC-48 — danh sách chỉ số, keyset pagination vì bảng này lớn nhất.</summary>
    [HttpGet("metrics")]
    public async Task<ActionResult<KeysetResult<HealthMetricDto>>> Metrics(
    [FromQuery] int? patientId, [FromQuery] MetricType? type,
    [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
    [FromQuery] string? cursor, [FromQuery] int size = 50)
    {
        return await _service.Metrics(patientId, type, from, to, cursor, size);
    }


    /// <summary>UC-46 — ghi chỉ số.</summary>
    [HttpPost("metrics")]
    public async Task<ActionResult<HealthMetricDto>> CreateMetric(CreateMetricRequest req)
    {
        return await _service.CreateMetric(req);
    }


    /// <summary>UC-47 — sửa chỉ số đã nhập.</summary>
    [HttpPut("metrics/{id:int}")]
    public async Task<IActionResult> UpdateMetric(int id, CreateMetricRequest req)
    {
        return await _service.UpdateMetric(id, req);
    }


    /// <summary>
    /// UC-47 — xoá chỉ số. XOÁ MỀM: bản ghi ẩn khỏi biểu đồ nhưng vẫn nằm trong
    /// CSDL để bác sĩ đối chiếu nếu cần (QT-5).
    /// </summary>
    [HttpDelete("metrics/{id:int}")]
    public async Task<IActionResult> DeleteMetric(int id, ConcurrencyRequest req)
    {
        return await _service.DeleteMetric(id, req);
    }


    /// <summary>UC-48 — tóm tắt để vẽ biểu đồ xu hướng.</summary>
    [HttpGet("metrics/summary/{patientId:int}")]
    public async Task<ActionResult<MetricSummaryDto>> Summary(int patientId, [FromQuery] int days = 30)
    {
        return await _service.Summary(patientId, days);
    }


    /* ---------------------------- LỐI SỐNG ---------------------------- */

    /// <summary>UC-51 — nhật ký ăn uống và vận động.</summary>
    [HttpGet("lifestyle")]
    public async Task<ActionResult<List<LifestyleLogDto>>> Lifestyle(
    [FromQuery] int? patientId, [FromQuery] int days = 14)
    {
        return await _service.Lifestyle(patientId, days);
    }


    [HttpPost("lifestyle")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<ActionResult<LifestyleLogDto>> CreateLifestyle(CreateLifestyleRequest req)
    {
        return await _service.CreateLifestyle(req);
    }


    /// <summary>UC-52 — xoá mềm nhật ký lối sống.</summary>
    [HttpDelete("lifestyle/{id:int}")]
    public async Task<IActionResult> DeleteLifestyle(int id, ConcurrencyRequest req)
    {
        return await _service.DeleteLifestyle(id, req);
    }


    /* ---------------------------- THUỐC ---------------------------- */

    /// <summary>UC-49 — lịch uống thuốc hôm nay.</summary>
    [HttpGet("medications/today")]
    public async Task<ActionResult<List<MedicationLogDto>>> Today([FromQuery] int? patientId)
    {
        return await _service.Today(patientId);
    }


    /// <summary>UC-49 — xác nhận đã uống thuốc.</summary>
    [HttpPut("medications/{id:int}/taken")]
    [Authorize(Roles = Roles.Patient)]
    public async Task<IActionResult> ConfirmTaken(int id, [FromQuery] bool taken = true)
    {
        return await _service.ConfirmTaken(id, taken);
    }
}
