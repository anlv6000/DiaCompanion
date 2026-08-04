using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class OverrideRequest : ReviewRequest
{
    [Required] public DrGrade FinalGrade { get; set; }
    /// <summary>BR-04: bắt buộc.</summary>
    [Required, MaxLength(1000)] public string Reason { get; set; } = "";
}
