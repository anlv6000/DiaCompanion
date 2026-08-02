using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class UpdatePatientRequest
{
    [Required, MaxLength(200)] public string FullName { get; set; } = "";
    public byte Gender { get; set; }
    [Required] public DateOnly DateOfBirth { get; set; }
    [Required, MaxLength(20)] public string Phone { get; set; } = "";
    [MaxLength(300)] public string? Address { get; set; }
    public byte DiabetesType { get; set; }
    public short? DiabetesDurationYears { get; set; }
    public decimal? BaselineHbA1c { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }

    [Required]
    public string RowVersion { get; set; } = "";
}
