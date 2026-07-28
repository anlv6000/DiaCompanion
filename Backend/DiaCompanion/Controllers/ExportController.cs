using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-34, UC-35 — kết xuất dữ liệu.</summary>
[Route("api/export")]
public class ExportController : BaseApiController
{
    private readonly IExportService _service;

    public ExportController(IExportService service) => _service = service;


    /// <summary>
    /// UC-34 — dữ liệu báo cáo khám.
    ///
    /// Trả JSON để client dựng PDF, thay vì sinh PDF ở server: bản Electron
    /// đã có sẵn khả năng in, và làm vậy tránh thêm phụ thuộc thư viện PDF
    /// vào backend. Bệnh nhân cũng gọi được endpoint này cho lượt khám của mình
    /// (BR-13), nhưng CHỈ khi lượt khám đã hoàn tất.
    /// </summary>
    [HttpGet("visit-report/{visitId:int}")]
    public async Task<IActionResult> VisitReport(int visitId)
    {
        return await _service.VisitReport(visitId);
    }


    /// <summary>
    /// UC-35 — tập ca người–máy mâu thuẫn.
    ///
    /// Đây là dữ liệu đánh giá chính của đề tài: nếu tỉ lệ ghi đè trong nhóm
    /// BỊ GẮN CỜ cao hơn hẳn nhóm không gắn cờ, nghĩa là cơ chế deferral đang
    /// bắt đúng những ca mà mô hình thực sự sai.
    /// </summary>
    [HttpGet("disagreement-cases")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<object>> DisagreementCases([FromQuery] int? modelVersionId)
    {
        return await _service.DisagreementCases(modelVersionId);
    }


    /// <summary>UC-35 — kết xuất CSV để phân tích ngoài hệ thống.</summary>
    [HttpGet("disagreement-cases.csv")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> DisagreementCsv([FromQuery] int? modelVersionId)
    {
        return await _service.DisagreementCsv(modelVersionId);
    }
}
