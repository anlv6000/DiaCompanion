using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class QualityCheckRequest
{
    [Required] public QualityStatus Status { get; set; }
    /// <summary>Bắt buộc khi Status = Ungradable.</summary>
    [MaxLength(500)] public string? Note { get; set; }
}
