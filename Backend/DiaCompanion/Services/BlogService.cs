using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>UC-59..62 — blog giáo dục sức khỏe.</summary>
public class BlogService : BaseService, IBlogService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IClinicClock _clock;


    public BlogService(IRepository repository, ICurrentUser me, IClinicClock clock) { _repository = repository; _me = me;_clock = clock; }

    /// <summary>UC-59 — bệnh nhân chỉ thấy bài ĐÃ ĐĂNG.</summary>
    public async Task<ActionResult<PagedResult<BlogPostDto>>> Published(
        [FromQuery] string? q, [FromQuery] BlogCategory? category, [FromQuery] PageQuery page)
    {
        var query = _repository.BlogPosts.AsNoTracking().Where(b => b.IsPublished);

        if (!string.IsNullOrWhiteSpace(q) && q.Trim().Length >= 2)
        {
            var norm = VietnameseText.RemoveDiacritics(q);
            query = query.Where(b => EF.Functions.Like(b.Title, $"%{q}%")
                                  || EF.Functions.Like(b.Summary!, $"%{norm}%"));
        }
        if (category is BlogCategory c) query = query.Where(b => b.Category == c);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(b => b.PublishedAt)
            .Skip(page.Skip).Take(page.PageSize)
            .Select(b => new BlogPostDto
            {
                Id = b.Id,
                Title = b.Title,
                Summary = b.Summary,
                Category = (byte)b.Category,
                IsPublished = b.IsPublished,
                PublishedAt =  _clock.ToLocal(b.PublishedAt),
                AuthorName = b.Author!.FullName,
                CreatedAt = b.CreatedAt
            }).ToListAsync();

        return Ok(new PagedResult<BlogPostDto>
        { Items = items, Page = page.Page, PageSize = page.PageSize, TotalItems = total });
    }
    public async Task<ActionResult<BlogPostDto>> Get(int id)
    {
        var b = await _repository.BlogPosts.AsNoTracking().Include(x => x.Author)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        // Bài nháp chỉ nhân viên xem được
        if (!b.IsPublished && !_me.IsInRole(UserRole.Admin, UserRole.Doctor))
            throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        return Ok(Map(b, includeBody: true));
    }

    /// <summary>UC-60 — danh sách quản trị, GỒM CẢ BÀI NHÁP.</summary>
    public async Task<ActionResult<PagedResult<BlogPostDto>>> Manage(
        [FromQuery] bool? published, [FromQuery] PageQuery page)
    {
        var query = _repository.BlogPosts.AsNoTracking().AsQueryable();

        if (published is bool p)
            query = query.Where(b => b.IsPublished == p);

        var total = await query.CountAsync();

        // Chạy SQL lấy dữ liệu UTC từ DB trước
        var posts = await query
            .Include(b => b.Author)
            .OrderByDescending(b => b.UpdatedAt ?? b.CreatedAt)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .ToListAsync();

        // Sau khi SQL xong mới đổi UTC -> giờ Việt Nam
        var items = posts.Select(b => Map(b, includeBody: false)).ToList();

        return Ok(new PagedResult<BlogPostDto>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = total
        });
    }

    /// <summary>UC-61 — soạn bài mới (lưu ở trạng thái nháp).</summary>
    public async Task<ActionResult<BlogPostDto>> Create(SaveBlogRequest req)
    {
        var post = new BlogPost
        {
            AuthorId = _me.RequireId(),
            Title = req.Title.Trim(),
            Summary = req.Summary,
            Body = req.Body,
            Category = req.Category,
            IsPublished = false
        };
        _repository.BlogPosts.Add(post);
        await _repository.SaveChangesAsync();

        return Ok(await GetDtoAsync(post.Id));
    }

    /// <summary>UC-61 — sửa bài.</summary>
    public async Task<ActionResult<BlogPostDto>> Update(int id, SaveBlogRequest req)
    {
        var b = await _repository.BlogPosts.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        b.Title = req.Title.Trim();
        b.Summary = req.Summary;
        b.Body = req.Body;
        b.Category = req.Category;
        b.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();
        return Ok(await GetDtoAsync(id));
    }

    /// <summary>UC-62 — đăng hoặc gỡ bài.</summary>
    public async Task<IActionResult> Publish(int id, [FromQuery] bool value = true)
    {
        var b = await _repository.BlogPosts.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        b.IsPublished = value;
        b.PublishedAt = value ? (b.PublishedAt ?? DateTime.UtcNow) : b.PublishedAt;
        b.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();
        return Ok(new { message = value ? "Đã đăng bài viết." : "Đã gỡ bài viết." });
    }

    /// <summary>
    /// UC-62 — xoá bài.
    /// BR-08: bài NHÁP xoá cứng được vì không chứa dữ liệu bệnh nhân;
    /// bài ĐÃ ĐĂNG chỉ xoá mềm vì bệnh nhân có thể đã đọc và lưu liên kết.
    /// </summary>
    public async Task<IActionResult> Delete(int id)
    {
        var b = await _repository.BlogPosts.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        if (b.IsPublished)
        {
            b.IsDeleted = true;
            b.DeletedAt = DateTime.UtcNow;
            await _repository.SaveChangesAsync();
            return Ok(new { message = "Đã ẩn bài viết đã đăng." });
        }

        _repository.BlogPosts.Remove(b);
        await _repository.SaveChangesAsync();
        return Ok(new { message = "Đã xóa bài nháp." });
    }

    private async Task<BlogPostDto> GetDtoAsync(int id)
    {
        var b = await _repository.BlogPosts.AsNoTracking().Include(x => x.Author).FirstAsync(x => x.Id == id);
        return Map(b, includeBody: true);
    }

    private  BlogPostDto Map(BlogPost b, bool includeBody) => new()
    {
        Id = b.Id,
        Title = b.Title,
        Summary = b.Summary,
        Body = includeBody ? b.Body : null,
        Category = (byte)b.Category,
        IsPublished = b.IsPublished,
        // DB lưu UTC -> response trả giờ Việt Nam
        PublishedAt = b.PublishedAt.HasValue
        ? _clock.ToLocal(b.PublishedAt.Value)
        : null,
        AuthorName = b.Author?.FullName ?? "",
        CreatedAt = (DateTime)_clock.ToLocal(b.CreatedAt)

    };
}
