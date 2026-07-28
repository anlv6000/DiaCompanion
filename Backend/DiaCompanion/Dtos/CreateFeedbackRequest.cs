using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CreateFeedbackRequest
{
    public int? VisitId { get; set; }
    [Range(1, 5)] public byte Rating { get; set; }
    [MaxLength(300)] public string? Tags { get; set; }
    [MaxLength(1000)] public string? Comment { get; set; }
}
