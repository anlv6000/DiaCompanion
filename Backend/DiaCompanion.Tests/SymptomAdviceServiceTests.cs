using DiaCompanion.Api.Common;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public class SymptomAdviceServiceTests
{
    private readonly SymptomAdviceService _sut = new();

    [Theory(DisplayName = "TC-UNIT-SymptomAdviceService-001 — Khuyến cáo đúng mức độ và luôn có cảnh báo an toàn")]
    [InlineData(SymptomSeverity.Mild, "mức nhẹ")]
    [InlineData(SymptomSeverity.Moderate, "mức vừa")]
    [InlineData(SymptomSeverity.Severe, "có thể nghiêm trọng")]
    public void Generate_Returns_Severity_Specific_Advice(
        SymptomSeverity severity, string expectedText)
    {
        var result = _sut.Generate(severity);

        result.Should().Contain(expectedText);
        result.Should().Contain("không phải kênh cấp cứu");
        result.Should().Contain("115");
    }
}
