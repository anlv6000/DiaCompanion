using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Entities;

public class AiDiagnosis : IVoidable, IHasRowVersion
{
    public int Id { get; set; }
    public int FundusImageId { get; set; }
    public FundusImage? FundusImage { get; set; }

    // ModelVersionId được GIỮ LẠI để tương thích schema/API cũ và từ bây giờ
    // đại diện cho model DR. Hai model còn lại có FK riêng.
    public int ModelVersionId { get; set; }
    public ModelVersion? ModelVersion { get; set; }

    public int? LesionModelVersionId { get; set; }
    public ModelVersion? LesionModelVersion { get; set; }

    public int? FractalModelVersionId { get; set; }
    public ModelVersion? FractalModelVersion { get; set; }

    // ---- nhánh phân loại (DR model) ----
    public DrGrade DrGrade { get; set; }
    public decimal Confidence { get; set; }
    [MaxLength(200)] public string? GradeProbabilities { get; set; }

    // ---- nhánh phân vùng tổn thương (Lesion model) ----
    public DrGrade? LesionGradeImplied { get; set; }
    [MaxLength(400)] public string? LesionMaskPath { get; set; }
    public int? CountMA { get; set; }
    public int? CountHE { get; set; }
    public int? CountEX { get; set; }
    public int? CountSE { get; set; }
    public decimal? AreaMA { get; set; }
    public decimal? AreaHE { get; set; }
    public decimal? AreaEX { get; set; }
    public decimal? AreaSE { get; set; }

    // ---- Gap 2: tín hiệu bất đồng chéo ----
    public decimal? Disagreement { get; set; }
    public bool IsDeferred { get; set; }
    public DeferReason? DeferReason { get; set; }
    public decimal? ConfidenceThreshold { get; set; }
    public decimal? DisagreementThreshold { get; set; }

    // ---- Fractal model ----
    public decimal? FractalDimension { get; set; }
    [MaxLength(400)] public string? VesselMaskPath { get; set; }
    [MaxLength(300)] public string? FractalNote { get; set; }

    public int? InferenceMs { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsVoided { get; set; }
    [MaxLength(500)] public string? VoidReason { get; set; }
    public int? VoidedBy { get; set; }
    public DateTime? VoidedAt { get; set; }
    public int? LastReviewActionBy { get; set; }
    public DateTime? LastReviewActionAt { get; set; }

    public byte[]? RowVer { get; set; }

    public ICollection<DiagnosisReview> Reviews { get; set; } = new List<DiagnosisReview>();
}
