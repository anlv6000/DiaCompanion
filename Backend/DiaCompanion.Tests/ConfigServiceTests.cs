using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Moq;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public class ConfigServiceTests
{
    private readonly Mock<IRepository> _repository = new(MockBehavior.Strict);

    private ConfigService Create(string? value)
    {
        _repository
            .Setup(repository => repository.GetSystemConfigValueAsync(
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(value);
        return new ConfigService(_repository.Object);
    }

    [Fact(DisplayName = "TC-UNIT-ConfigService-001 — GetAsync trả đúng giá trị repository")]
    public async Task GetAsync_Returns_Repository_Value()
    {
        var sut = Create("configured");

        var result = await sut.GetAsync("key");

        result.Should().Be("configured");
    }

    [Theory(DisplayName = "TC-UNIT-ConfigService-002 — Decimal dùng invariant culture và fallback an toàn")]
    [InlineData("0.75", 0.75)]
    [InlineData("invalid", 0.35)]
    [InlineData(null, 0.35)]
    public async Task GetDecimalAsync_Parses_Or_Uses_Fallback(string? raw, decimal expected)
    {
        var sut = Create(raw);

        (await sut.GetDecimalAsync("decimal", 0.35m)).Should().Be(expected);
    }

    [Theory(DisplayName = "TC-UNIT-ConfigService-003 — Integer không hợp lệ dùng fallback")]
    [InlineData("12", 12)]
    [InlineData("12.5", 9)]
    [InlineData(null, 9)]
    public async Task GetIntAsync_Parses_Or_Uses_Fallback(string? raw, int expected)
    {
        var sut = Create(raw);

        (await sut.GetIntAsync("integer", 9)).Should().Be(expected);
    }

    [Theory(DisplayName = "TC-UNIT-ConfigService-004 — Chu kỳ tái khám có fallback theo mức DR")]
    [InlineData(DrGrade.Normal, 12)]
    [InlineData(DrGrade.Mild, 12)]
    [InlineData(DrGrade.Moderate, 6)]
    [InlineData(DrGrade.Severe, 3)]
    [InlineData(DrGrade.Pdr, 1)]
    public async Task GetRecheckMonthsAsync_Uses_Clinical_Fallback(DrGrade grade, byte expected)
    {
        var sut = Create(null);

        (await sut.GetRecheckMonthsAsync(grade)).Should().Be(expected);
    }

    [Theory(DisplayName = "TC-UNIT-ConfigService-005 — Giờ ca trực chỉ nhận đúng định dạng HH:mm")]
    [InlineData("07:00", 7, 0)]
    [InlineData("23:59", 23, 59)]
    [InlineData("7 AM", 6, 30)]
    [InlineData(null, 6, 30)]
    public async Task GetTimeAsync_Parses_Exact_Or_Uses_Fallback(
        string? raw, int expectedHour, int expectedMinute)
    {
        var sut = Create(raw);

        (await sut.GetTimeAsync("shift", new TimeOnly(6, 30)))
            .Should().Be(new TimeOnly(expectedHour, expectedMinute));
    }
}
