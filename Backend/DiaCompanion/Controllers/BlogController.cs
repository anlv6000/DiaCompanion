using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-54..57 — blog giáo dục sức khỏe.</summary>
[Route("api/blog")]
public class BlogController : BaseApiController
{
    private readonly IBlogService _service;
    public BlogController(IBlogService service) => _service = service;

    [HttpGet("published")]
    public async Task<ActionResult<PagedResult<BlogPostDto>>> Published(
        [FromQuery] string? q,
        [FromQuery] BlogCategory? category,
        [FromQuery] PageQuery page) =>
        await _service.Published(q, category, page);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BlogPostDto>> Get(int id) => await _service.Get(id);

    [HttpGet("manage")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<ActionResult<PagedResult<BlogPostDto>>> Manage(
        [FromQuery] string? q,
        [FromQuery] bool? published,
        [FromQuery] BlogCategory? category,
        [FromQuery] int? authorId,
        [FromQuery] PageQuery page) =>
        await _service.Manage(q, published, category, authorId, page);

    [HttpPost]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<ActionResult<BlogPostDto>> Create(SaveBlogRequest req) =>
        await _service.Create(req);

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<ActionResult<BlogPostDto>> Update(int id, SaveBlogRequest req) =>
        await _service.Update(id, req);

    [HttpPut("{id:int}/publish")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<IActionResult> Publish(int id, ConcurrencyRequest req) =>
        await _service.Publish(id, true, req);

    [HttpPut("{id:int}/unpublish")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<IActionResult> Unpublish(int id, ConcurrencyRequest req) =>
        await _service.Publish(id, false, req);

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.DoctorOrAdmin)]
    public async Task<IActionResult> Delete(int id, [FromQuery] string rowVersion) =>
        await _service.Delete(id, rowVersion);
}
