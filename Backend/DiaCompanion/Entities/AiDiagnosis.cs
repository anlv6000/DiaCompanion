using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Entities;

public class AiDiagnosis : IVoidable, IHasRowVersion
{
    public int Id { get; set; }
    public int FundusImageId { get; set; }
    public FundusImage? FundusImage { get; set; }
    /// <summary>BR-17: kết quả lưu kèm phiên bản đã sinh ra nó; đổi model không đổi kết quả cũ.</summary>
    public int ModelVersionId { get; set; }
    public ModelVersion? ModelVersion { get; set; }

    // ---- nhánh phân loại ----
    public DrGrade DrGrade { get; set; }
    public decimal Confidence { get; set; }
    [MaxLength(200)] public string? GradeProbabilities { get; set; }

    // ---- nhánh phân vùng ----
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

    // ---- Gap 2: tín hiệu bất đồng chéo (đóng góp chính của đề tài) ----
    public decimal? Disagreement { get; set; }
    public bool IsDeferred { get; set; }
    public DeferReason? DeferReason { get; set; }
    /// <summary>Ngưỡng TẠI THỜI ĐIỂM CHẠY — admin đổi ngưỡng sau không làm đổi kết quả đã lưu.</summary>
    public decimal? ConfidenceThreshold { get; set; }
    public decimal? DisagreementThreshold { get; set; }

    // ---- Gap 3 ----
    public decimal? FractalDimension { get; set; }
    [MaxLength(400)] public string? VesselMaskPath { get; set; }
    [MaxLength(300)] public string? FractalNote { get; set; }

    public int? InferenceMs { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsVoided { get; set; }
    [MaxLength(500)] public string? VoidReason { get; set; }
    public int? VoidedBy { get; set; }
    public DateTime? VoidedAt { get; set; }
    /// <summary>Người và thời điểm thực hiện thao tác review gần nhất.</summary>
    public int? LastReviewActionBy { get; set; }
    public DateTime? LastReviewActionAt { get; set; }


    /// <summary>QT-9: chặn hai bác sĩ cùng duyệt một ca (xung đột → HTTP 409).</summary>
    public byte[]? RowVer { get; set; }

    public ICollection<DiagnosisReview> Reviews { get; set; } = new List<DiagnosisReview>();
}
