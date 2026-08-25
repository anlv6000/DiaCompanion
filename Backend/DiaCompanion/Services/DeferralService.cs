using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Services;

/// <summary>
/// NF-05 / NF-06 — Gap 2, đóng góp chính của đề tài.
///
/// Ý tưởng: hai nhánh đọc cùng một ảnh cho hai mục đích khác nhau. Khi nhánh
/// phân loại nói "Moderate" mà phân bố tổn thương lại tương ứng "Severe", hai
/// cách đọc cùng một võng mạc mâu thuẫn nhau. Mâu thuẫn đó là thông tin mà
/// không đầu ra nào tự nó mang được: nó cho biết ảnh khó thật, hoặc mô hình
/// đang chạy ngoài vùng năng lực.
///
/// THIẾT KẾ MỚI (bỏ độ tin cậy):
///   Độ tin cậy Module 1 không phải xác suất (mô hình hồi quy, không softmax),
///   nên đã NGHỈ HƯU khỏi quyết định. Defer nay chỉ dựa trên (a) bất đồng chéo
///   và (b) thiếu nhánh. Điểm nguy cơ nền của bệnh nhân HẠ ngưỡng bất đồng:
///   bệnh nhân nguy cơ cao thì chỉ cần chênh một bậc đã cần bác sĩ xem.
///   Điểm nguy cơ KHÔNG đụng DR grade và không thay Doctor confirmation.
/// </summary>
public interface IDeferralService
{
    DeferralResult Evaluate(DrGrade gradeHead, DrGrade? lesionImplied,
                            int riskScore, decimal baseDisagreementThreshold);
}

public record DeferralResult(
    decimal? Disagreement,
    bool IsDeferred,
    DeferReason? Reason,
    decimal EffectiveThreshold);

public class DeferralService : IDeferralService
{
    /// <summary>Thang DR có 5 mức nên chênh lệch tối đa là 4 bậc.</summary>
    private const decimal MaxGradeDistance = 4m;

    /// <summary>Sàn cứng: ngưỡng hiệu dụng không bao giờ xuống dưới mức này.</summary>
    private const decimal MinThreshold = 0.05m;

    /// <summary>Mỗi điểm nguy cơ hạ ngưỡng một bước nhỏ.</summary>
    private const decimal RiskStep = 0.05m;

    /// <summary>Tác động của nguy cơ bị chặn trên: chỉ 3 điểm đầu có hiệu lực.</summary>
    private const int MaxRiskEffect = 3;

    public DeferralResult Evaluate(
        DrGrade gradeHead,
        DrGrade? lesionImplied,
        int riskScore,
        decimal baseDisagreementThreshold)
    {
        // Ngưỡng hiệu dụng = ngưỡng gốc - 0.05 x min(riskScore, 3), có sàn 0.05.
        // Với gốc 0.35 và riskScore >= 3, ngưỡng xuống 0.20 — vừa đủ để "chênh
        // một bậc" (0.25) kích hoạt defer, không bao giờ tới mức defer tất cả.
        var clamped = Math.Min(Math.Max(riskScore, 0), MaxRiskEffect);
        var effective = baseDisagreementThreshold - RiskStep * clamped;
        if (effective < MinThreshold) effective = MinThreshold;

        // Thiếu kết quả một nhánh thì không tính được bất đồng.
        // Mặc định CHUYỂN BÁC SĨ, không mặc định tin tưởng — an toàn nghiêng
        // về phía con người khi hệ thống thiếu thông tin.
        if (lesionImplied is null)
            return new DeferralResult(null, true, DeferReason.MissingBranch, effective);

        // Chuẩn hoá khoảng cách thứ bậc về [0,1].
        var distance = Math.Abs((int)gradeHead - (int)lesionImplied.Value);
        var disagreement = Math.Round(distance / MaxGradeDistance, 4);

        // Chỉ còn một tín hiệu sinh mới: bất đồng vượt ngưỡng hiệu dụng.
        var deferred = disagreement > effective;
        var reason = deferred ? DeferReason.HighDisagreement : (DeferReason?)null;

        return new DeferralResult(disagreement, deferred, reason, effective);
    }
}
