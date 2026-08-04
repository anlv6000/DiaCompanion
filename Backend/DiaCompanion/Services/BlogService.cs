using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DiaCompanion.Api.Services;

/// <summary>UC-54..57 — blog giáo dục sức khỏe.</summary>
public class BlogService : BaseService, IBlogService
{
    private readonly IRepository _repository;
    private readonly ICurrentUser _me;
    private readonly IClinicClock _clock;
    private readonly IAuditService _audit;

    public BlogService(
        IRepository repository,
        ICurrentUser me,
        IClinicClock clock,
        IAuditService audit)
    {
        _repository = repository;
        _me = me;
        _clock = clock;
        _audit = audit;
    }

    /// <summary>UC-54 — người dùng đã đăng nhập chỉ thấy bài đang được xuất bản.</summary>
    public async Task<ActionResult<PagedResult<BlogPostDto>>> Published(
        string? q,
        BlogCategory? category,
        PageQuery page)
    {
        var query = _repository.BlogPosts.AsNoTracking()
            .Where(b => b.IsPublished);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var keyword = q.Trim();
            query = query.Where(b =>
                EF.Functions.Like(b.Title, $"%{keyword}%")
                || (b.Summary != null && EF.Functions.Like(b.Summary, $"%{keyword}%"))
                || EF.Functions.Like(b.Body, $"%{keyword}%"));
        }

        if (category is BlogCategory selectedCategory)
            query = query.Where(b => b.Category == selectedCategory);

        var total = await query.CountAsync();
        query = ApplySort(query, page, publishedView: true);

        var posts = await query
            .Include(b => b.Author)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .ToListAsync();

        return Ok(new PagedResult<BlogPostDto>
        {
            Items = posts.Select(b => Map(b, includeBody: false)).ToList(),
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = total
        });
    }

    public async Task<ActionResult<BlogPostDto>> Get(int id)
    {
        var post = await _repository.BlogPosts.AsNoTracking()
            .Include(x => x.Author)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        if (!post.IsPublished && !_me.IsInRole(UserRole.Admin, UserRole.Doctor))
            throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        return Ok(Map(post, includeBody: true));
    }

    /// <summary>UC-55 — danh sách bài đăng và bản nháp có tìm kiếm, lọc, sắp xếp, phân trang.</summary>
    public async Task<ActionResult<PagedResult<BlogPostDto>>> Manage(
        string? q,
        bool? published,
        BlogCategory? category,
        int? authorId,
        PageQuery page)
    {
        var query = _repository.BlogPosts.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var keyword = q.Trim();
            query = query.Where(b =>
                EF.Functions.Like(b.Title, $"%{keyword}%")
                || (b.Summary != null && EF.Functions.Like(b.Summary, $"%{keyword}%"))
                || EF.Functions.Like(b.Body, $"%{keyword}%"));
        }

        if (published is bool isPublished)
            query = query.Where(b => b.IsPublished == isPublished);
        if (category is BlogCategory selectedCategory)
            query = query.Where(b => b.Category == selectedCategory);
        if (authorId is int selectedAuthorId)
            query = query.Where(b => b.AuthorId == selectedAuthorId);

        var total = await query.CountAsync();
        query = ApplySort(query, page, publishedView: false);

        var posts = await query
            .Include(b => b.Author)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .ToListAsync();

        return Ok(new PagedResult<BlogPostDto>
        {
            Items = posts.Select(b => Map(b, includeBody: false)).ToList(),
            Page = page.Page,
            PageSize = page.PageSize,
            TotalItems = total
        });
    }

    /// <summary>UC-56 — tạo bài mới ở trạng thái nháp.</summary>
    public async Task<ActionResult<BlogPostDto>> Create(SaveBlogRequest req)
    {
        var post = new BlogPost
        {
            AuthorId = _me.RequireId(),
            Title = req.Title.Trim(),
            Summary = req.Summary?.Trim(),
            Body = req.Body.Trim(),
            Category = req.Category,
            IsPublished = false,
            CreatedAt = _clock.UtcNow
        };

        _repository.BlogPosts.Add(post);
        await _repository.SaveChangesAsync();

        await _audit.LogAsync(
            AuditAction.BlogCreate,
            nameof(BlogPost),
            post.Id,
            null,
            new { post.Title, category = post.Category.ToString(), post.AuthorId });
        await _repository.SaveChangesAsync();

        return Ok(await GetDtoAsync(post.Id));
    }

    /// <summary>UC-56 — sửa nội dung bài với optimistic concurrency.</summary>
    public async Task<ActionResult<BlogPostDto>> Update(int id, SaveBlogRequest req)
    {
        var post = await _repository.BlogPosts.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        _repository.ApplyOriginalRowVersion(post, req.RowVersion);
        var before = new
        {
            post.Title,
            post.Summary,
            post.Body,
            category = post.Category.ToString()
        };

        post.Title = req.Title.Trim();
        post.Summary = req.Summary?.Trim();
        post.Body = req.Body.Trim();
        post.Category = req.Category;
        post.UpdatedAt = _clock.UtcNow;

        await _audit.LogAsync(
            AuditAction.BlogUpdate,
            nameof(BlogPost),
            post.Id,
            before,
            new
            {
                post.Title,
                post.Summary,
                post.Body,
                category = post.Category.ToString()
            });
        await _repository.SaveChangesAsync();

        return Ok(await GetDtoAsync(id));
    }

    /// <summary>UC-57 — đăng hoặc gỡ bài với kiểm tra phiên bản hiện tại.</summary>
    public async Task<IActionResult> Publish(int id, bool value, ConcurrencyRequest req)
    {
        var post = await _repository.BlogPosts.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        _repository.ApplyOriginalRowVersion(post, req.RowVersion);

        if (post.IsPublished == value)
            return Ok(new
            {
                message = value ? "Bài viết đang ở trạng thái đã đăng." : "Bài viết đang ở trạng thái bản nháp.",
                rowVersion = post.ToRowVersion()
            });

        var oldState = post.IsPublished;
        post.IsPublished = value;
        post.PublishedAt = value ? (post.PublishedAt ?? _clock.UtcNow) : post.PublishedAt;
        post.UpdatedAt = _clock.UtcNow;

        await _audit.LogAsync(
            AuditAction.BlogState,
            nameof(BlogPost),
            post.Id,
            new { isPublished = oldState },
            new { isPublished = post.IsPublished });
        await _repository.SaveChangesAsync();

        return Ok(new
        {
            message = value ? "Đã đăng bài viết." : "Đã gỡ bài viết.",
            rowVersion = post.ToRowVersion()
        });
    }

    /// <summary>
    /// UC-57 — bản nháp được xóa cứng; bài từng công bố được xóa mềm để giữ liên kết và audit.
    /// </summary>
    public async Task<IActionResult> Delete(int id, string rowVersion)
    {
        var post = await _repository.BlogPosts.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw AppException.NotFound(Msg.LoadFailed, "Không tìm thấy bài viết.");

        _repository.ApplyOriginalRowVersion(post, rowVersion);

        if (post.IsPublished || post.PublishedAt != null)
        {
            post.IsDeleted = true;
            post.DeletedAt = _clock.UtcNow;
            post.UpdatedAt = _clock.UtcNow;

            await _audit.LogAsync(
                AuditAction.BlogState,
                nameof(BlogPost),
                post.Id,
                new { post.IsPublished, isDeleted = false },
                new { post.IsPublished, isDeleted = true },
                "Ẩn bài viết đã từng được công bố");
            await _repository.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã ẩn bài viết đã đăng.",
                rowVersion = post.ToRowVersion()
            });
        }

        await _audit.LogAsync(
            AuditAction.BlogState,
            nameof(BlogPost),
            post.Id,
            new { post.Title, isDraft = true },
            null,
            "Xóa cứng bản nháp chưa từng công bố");
        _repository.BlogPosts.Remove(post);
        await _repository.SaveChangesAsync();
        return Ok(new { message = "Đã xóa bài nháp." });
    }

    private static IQueryable<BlogPost> ApplySort(
        IQueryable<BlogPost> query,
        PageQuery page,
        bool publishedView)
    {
        return page.Sort?.Trim().ToLowerInvariant() switch
        {
            "title" => page.Desc
                ? query.OrderByDescending(b => b.Title).ThenByDescending(b => b.Id)
                : query.OrderBy(b => b.Title).ThenBy(b => b.Id),
            "author" => page.Desc
                ? query.OrderByDescending(b => b.Author!.FullName).ThenByDescending(b => b.Id)
                : query.OrderBy(b => b.Author!.FullName).ThenBy(b => b.Id),
            "category" => page.Desc
                ? query.OrderByDescending(b => b.Category).ThenByDescending(b => b.Id)
                : query.OrderBy(b => b.Category).ThenBy(b => b.Id),
            "published" => page.Desc
                ? query.OrderByDescending(b => b.PublishedAt).ThenByDescending(b => b.Id)
                : query.OrderBy(b => b.PublishedAt).ThenBy(b => b.Id),
            _ when publishedView => query
                .OrderByDescending(b => b.PublishedAt)
                .ThenByDescending(b => b.Id),
            _ => query
                .OrderByDescending(b => b.UpdatedAt ?? b.CreatedAt)
                .ThenByDescending(b => b.Id)
        };
    }

    private async Task<BlogPostDto> GetDtoAsync(int id)
    {
        var post = await _repository.BlogPosts.AsNoTracking()
            .Include(x => x.Author)
            .FirstAsync(x => x.Id == id);
        return Map(post, includeBody: true);
    }

    private BlogPostDto Map(BlogPost post, bool includeBody) => new()
    {
        Id = post.Id,
        Title = post.Title,
        Summary = post.Summary,
        Body = includeBody ? post.Body : null,
        Category = (byte)post.Category,
        IsPublished = post.IsPublished,
        PublishedAt = _clock.ToLocal(post.PublishedAt),
        AuthorName = post.Author?.FullName ?? "",
        CreatedAt = _clock.ToLocal(post.CreatedAt)!.Value,
        UpdatedAt = _clock.ToLocal(post.UpdatedAt),
        RowVersion = post.ToRowVersion()
    };
}
