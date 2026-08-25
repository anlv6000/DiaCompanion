using DiaCompanion.Api.Common;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Xunit;

namespace DiaCompanion.Tests.Unit;

/// <summary>
/// TC-UNIT-DeferralService-001..007
///
/// Đây là lớp đáng kiểm thử kỹ nhất trong hệ thống: nó hiện thực Gap 2, đóng
/// góp nghiên cứu chính. Lớp này thuần tuý tính toán, không phụ thuộc gì bên
/// ngoài, nên kiểm thử được trực tiếp mà không cần giả lập — vì vậy cũng không
/// có lý do gì để bỏ sót nhánh nào.
///
/// Điểm cần chú ý khi đọc số liệu: disagreement xuất phát từ hiệu hai số nguyên
/// chia cho 4, nên nó CHỈ nhận đúng năm giá trị rời rạc 0 / 0,25 / 0,5 / 0,75 / 1.
/// Với ngưỡng mặc định 0,35 thì quy tắc thực chất là “chênh từ hai bậc trở lên”.
/// </summary>
public class DeferralServiceTests
{
    private const decimal ConfThreshold = 0.75m;
    private const decimal DisagreeThreshold = 0.35m;

    private readonly DeferralService _sut = new();

    private DeferralResult Evaluate(DrGrade head, decimal conf, DrGrade? lesion) =>
        _sut.Evaluate(head, conf, lesion, ConfThreshold, DisagreeThreshold);

    // ---------------------------------------------------------------- happy path

    [Fact(DisplayName = "TC-UNIT-DeferralService-001 — Hai nhánh đồng thuận, tin cậy cao thì không chuyển bác sĩ")]
    public void Agreement_And_High_Confidence_Is_Not_Deferred()
    {
        var result = Evaluate(DrGrade.Moderate, 0.92m, DrGrade.Moderate);

        result.Disagreement.Should().Be(0m);
        result.IsDeferred.Should().BeFalse();
        result.Reason.Should().BeNull();
    }

    // ---------------------------------------------------------------- công thức

    [Theory(DisplayName = "TC-UNIT-DeferralService-002 — Bất đồng chuẩn hoá theo thang 5 mức")]
    [InlineData(DrGrade.Normal, DrGrade.Normal, 0.00)]
    [InlineData(DrGrade.Normal, DrGrade.Mild, 0.25)]
    [InlineData(DrGrade.Normal, DrGrade.Moderate, 0.50)]
    [InlineData(DrGrade.Normal, DrGrade.Severe, 0.75)]
    [InlineData(DrGrade.Normal, DrGrade.Pdr, 1.00)]
    // Trị tuyệt đối: đảo chiều phải cho cùng kết quả.
    [InlineData(DrGrade.Pdr, DrGrade.Normal, 1.00)]
    public void Disagreement_Is_Absolute_Distance_Over_Four(
        DrGrade head, DrGrade lesion, double expected)
    {
        var result = Evaluate(head, 0.99m, lesion);

        result.Disagreement.Should().Be((decimal)expected);
    }

    // ---------------------------------------------------------------- bốn lý do

    [Fact(DisplayName = "TC-UNIT-DeferralService-003 — Tin cậy thấp trong khi hai nhánh đồng thuận")]
    public void Low_Confidence_Alone_Defers_With_Reason_LowConfidence()
    {
        var result = Evaluate(DrGrade.Mild, 0.60m, DrGrade.Mild);

        result.IsDeferred.Should().BeTrue();
        result.Reason.Should().Be(DeferReason.LowConfidence);
    }

    [Fact(DisplayName = "TC-UNIT-DeferralService-004 — Bất đồng cao trong khi mô hình rất tự tin")]
    public void High_Disagreement_Alone_Defers_With_Reason_HighDisagreement()
    {
        // Đây là ca biện minh cho toàn bộ Gap 2: điểm softmax không hề báo động,
        // chỉ có khoảng cách giữa hai nhánh mới lộ ra vấn đề.
        var result = Evaluate(DrGrade.Normal, 0.92m, DrGrade.Moderate);

        result.Disagreement.Should().Be(0.50m);
        result.IsDeferred.Should().BeTrue();
        result.Reason.Should().Be(DeferReason.HighDisagreement);
    }

    [Fact(DisplayName = "TC-UNIT-DeferralService-005 — Cả hai tín hiệu cùng kêu")]
    public void Both_Signals_Defer_With_Reason_Both()
    {
        var result = Evaluate(DrGrade.Normal, 0.55m, DrGrade.Pdr);

        result.IsDeferred.Should().BeTrue();
        result.Reason.Should().Be(DeferReason.Both);
    }

    [Fact(DisplayName = "TC-UNIT-DeferralService-006 — Thiếu nhánh tổn thương thì mặc định chuyển bác sĩ")]
    public void Missing_Lesion_Branch_Defers_Even_When_Confidence_Is_Very_High()
    {
        // Fail-safe: không tính được bất đồng thì nghiêng về phía con người,
        // KHÔNG mặc định tin tưởng mô hình.
        var result = Evaluate(DrGrade.Severe, 0.98m, null);

        result.Disagreement.Should().BeNull();
        result.IsDeferred.Should().BeTrue();
        result.Reason.Should().Be(DeferReason.MissingBranch);
    }

    // ---------------------------------------------------------------- biên

    [Theory(DisplayName = "TC-UNIT-DeferralService-007 — Biên của ngưỡng tin cậy dùng so sánh nghiêm ngặt")]
    [InlineData(0.7499, true)]   // dưới ngưỡng  -> chuyển
    [InlineData(0.7500, false)]  // đúng ngưỡng  -> KHÔNG chuyển
    [InlineData(0.7501, false)]  // trên ngưỡng  -> không chuyển
    public void Confidence_Boundary_Is_Strict(decimal confidence, bool expectDeferred)
    {
        var result = Evaluate(DrGrade.Mild, confidence, DrGrade.Mild);

        result.IsDeferred.Should().Be(expectDeferred);
    }

    [Fact(DisplayName = "TC-UNIT-DeferralService-008 — Chênh một bậc chưa vượt ngưỡng bất đồng")]
    public void One_Grade_Apart_Does_Not_Reach_Threshold()
    {
        // 0,25 < 0,35 nên không chuyển. Đây là hệ quả trực tiếp của việc
        // disagreement chỉ nhận năm giá trị rời rạc, cần nêu rõ trong báo cáo.
        var result = Evaluate(DrGrade.Mild, 0.90m, DrGrade.Moderate);

        result.Disagreement.Should().Be(0.25m);
        result.IsDeferred.Should().BeFalse();
    }
}
