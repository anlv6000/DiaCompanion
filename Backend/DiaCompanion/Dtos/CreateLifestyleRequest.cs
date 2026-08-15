using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CreateLifestyleRequest
{
    public DateOnly? LogLocalDate { get; set; }
    [MaxLength(500)] public string? MealNote { get; set; }
    [MaxLength(300)] public string? MealTags { get; set; }
    public short? ExerciseMinutes { get; set; }
    [MaxLength(100)] public string? ExerciseType { get; set; }
    public string? RowVersion { get; set; }
}
