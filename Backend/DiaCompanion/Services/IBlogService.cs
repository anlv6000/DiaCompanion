using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

public interface IBlogService
{
    Task<ActionResult<PagedResult<BlogPostDto>>> Published(
        [FromQuery] string? q, [FromQuery] BlogCategory? category, [FromQuery] PageQuery page);
    Task<ActionResult<BlogPostDto>> Get(int id);
    Task<ActionResult<PagedResult<BlogPostDto>>> Manage(
        [FromQuery] bool? published, [FromQuery] PageQuery page);
    Task<ActionResult<BlogPostDto>> Create(SaveBlogRequest req);
    Task<ActionResult<BlogPostDto>> Update(int id, SaveBlogRequest req);
    Task<IActionResult> Publish(int id, [FromQuery] bool value = true);
    Task<IActionResult> Delete(int id);
}
