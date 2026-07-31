using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

using DiaCompanion.Api.Services;
namespace DiaCompanion.Api.Controllers;

/// <summary>UC-59..62 — blog giáo dục sức khỏe.</summary>
[Route("api/blog")]
public class BlogController : BaseApiController
{
    private readonly IBlogService _service;

    public BlogController(IBlogService service) => _service = service;


    /// <summary>UC-59 — bệnh nhân chỉ thấy bài ĐÃ ĐĂNG.</summary>
    [HttpGet("published")]
    [AllowAnonymous]
    public async Task<ActionResult<PagedResult<BlogPostDto>>> Published(
    [FromQuery] string? q, [FromQuery] BlogCategory? category, [FromQuery] PageQuery page)
    {
        return await _service.Published(q, category, page);
    }


    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<BlogPostDto>> Get(int id)
    {
        return await _service.Get(id);
    }


    /// <summary>UC-60 — danh sách quản trị, GỒM CẢ BÀI NHÁP.</summary>
    [HttpGet("manage")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<ActionResult<PagedResult<BlogPostDto>>> Manage(
    [FromQuery] bool? published, [FromQuery] PageQuery page)
    {
        return await _service.Manage(published, page);
    }


    /// <summary>UC-61 — soạn bài mới (lưu ở trạng thái nháp).</summary>
    [HttpPost]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<ActionResult<BlogPostDto>> Create(SaveBlogRequest req)
    {
        return await _service.Create(req);
    }


    /// <summary>UC-61 — sửa bài.</summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<ActionResult<BlogPostDto>> Update(int id, SaveBlogRequest req)
    {
        return await _service.Update(id, req);
    }


    /// <summary>UC-62 — đăng hoặc gỡ bài.</summary>
    [HttpPut("{id:int}/publish")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<IActionResult> Publish(int id, [FromQuery] bool value = true)
    {
        return await _service.Publish(id, value);
    }


    /// <summary>
    /// UC-62 — xoá bài.
    /// BR-08: bài NHÁP xoá cứng được vì không chứa dữ liệu bệnh nhân;
    /// bài ĐÃ ĐĂNG chỉ xoá mềm vì bệnh nhân có thể đã đọc và lưu liên kết.
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<IActionResult> Delete(int id)
    {
        return await _service.Delete(id);
    }
}
