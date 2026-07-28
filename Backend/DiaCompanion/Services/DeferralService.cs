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
/// Khác biệt với công trình gần nhất (LLNet): họ HỢP NHẤT hai nhánh để tăng
/// độ chính xác, coi bất đồng là nhiễu cần khử. Ở đây hai nhánh được giữ TÁCH
/// BIỆT và chính khoảng cách giữa chúng là đầu ra cần đo.
/// </summary>
public interface IDeferralService
{
    DeferralResult Evaluate(DrGrade gradeHead, decimal confidence, DrGrade? lesionImplied,
                            decimal confidenceThreshold, decimal disagreementThreshold);
}

public record DeferralResult(
    decimal? Disagreement,
    bool IsDeferred,
    DeferReason? Reason);

public class DeferralService : IDeferralService
{
    /// <summary>Thang DR có 5 mức nên chênh lệch tối đa là 4 bậc.</summary>
    private const decimal MaxGradeDistance = 4m;

    public DeferralResult Evaluate(
        DrGrade gradeHead,
        decimal confidence,
        DrGrade? lesionImplied,
        decimal confidenceThreshold,
        decimal disagreementThreshold)
    {
        // Thiếu kết quả một nhánh thì không tính được bất đồng.
        // Mặc định CHUYỂN BÁC SĨ, không mặc định tin tưởng — an toàn nghiêng
        // về phía con người khi hệ thống thiếu thông tin.
        if (lesionImplied is null)
            return new DeferralResult(null, true, DeferReason.MissingBranch);

        // Chuẩn hoá khoảng cách thứ bậc về [0,1].
        // Đây là chỗ QT-8 phát huy tác dụng: DrGrade lưu dạng số nên chỉ cần
        // một phép trừ; nếu lưu chuỗi thì phải ánh xạ lại ở mọi lần tính.
        var distance = Math.Abs((int)gradeHead - (int)lesionImplied.Value);
        var disagreement = Math.Round(distance / MaxGradeDistance, 4);

        var lowConfidence = confidence < confidenceThreshold;
        var highDisagreement = disagreement > disagreementThreshold;

        // BR-03: tin cậy thấp HOẶC bất đồng cao đều chuyển bác sĩ.
        // Dùng OR chứ không AND: mỗi tín hiệu bắt một dạng thất bại khác nhau,
        // đòi hỏi cả hai cùng kêu sẽ bỏ sót phần lớn ca đáng ngờ.
        var reason = (lowConfidence, highDisagreement) switch
        {
            (true, true)  => DeferReason.Both,
            (true, false) => DeferReason.LowConfidence,
            (false, true) => DeferReason.HighDisagreement,
            _             => (DeferReason?)null
        };

        return new DeferralResult(disagreement, reason.HasValue, reason);
    }
}
