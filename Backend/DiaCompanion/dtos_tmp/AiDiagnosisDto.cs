using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class AiDiagnosisDto
{
    public int Id { get; set; }
    public int FundusImageId { get; set; }
    public byte Eye { get; set; }
    public string ModelVersion { get; set; } = "";

    public byte DrGrade { get; set; }
    public string DrGradeLabel { get; set; } = "";
    public decimal Confidence { get; set; }

    public byte? LesionGradeImplied { get; set; }
    public int? CountMA { get; set; }
    public int? CountHE { get; set; }
    public int? CountEX { get; set; }
    public int? CountSE { get; set; }

    // Gap 2
    public decimal? Disagreement { get; set; }
    public bool IsDeferred { get; set; }
    public byte? DeferReason { get; set; }
    public string? DeferReasonLabel { get; set; }

    // Gap 3
    public decimal? FractalDimension { get; set; }
    public string? FractalNote { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>NT-3: false cho tới khi bác sĩ duyệt hoặc ghi đè.</summary>
    public bool IsConfirmed { get; set; }
    public ReviewDto? Review { get; set; }

    /// <summary>Token chống tương tranh; client phải gửi lại khi duyệt (QT-9).</summary>
    public string? RowVersion { get; set; }
}
