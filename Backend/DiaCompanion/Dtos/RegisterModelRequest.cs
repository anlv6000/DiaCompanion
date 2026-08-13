using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class RegisterModelRequest
{
    [EnumDataType(typeof(ModelType))]
    public ModelType ModelType { get; set; }

    [Required, MaxLength(100)] public string Name { get; set; } = "";
    [Required, MaxLength(400)] public string FilePath { get; set; } = "";
    [Required, MinLength(64), MaxLength(64)] public string Sha256 { get; set; } = "";
    public decimal? Qwk { get; set; }
    public decimal? Dice { get; set; }
    public decimal? IoU { get; set; }
    [MaxLength(500)] public string? Note { get; set; }
}
