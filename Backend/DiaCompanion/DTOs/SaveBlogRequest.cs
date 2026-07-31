using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class SaveBlogRequest
{
    [Required, MaxLength(300)] public string Title { get; set; } = "";
    [MaxLength(500)] public string? Summary { get; set; }
    [Required] public string Body { get; set; } = "";
    public BlogCategory Category { get; set; } = BlogCategory.Knowledge;
}
