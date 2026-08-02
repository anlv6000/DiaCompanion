using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

/// <summary>Version token returned by the last GET response.</summary>
public class ConcurrencyRequest
{
    [Required]
    public string RowVersion { get; set; } = "";
}
