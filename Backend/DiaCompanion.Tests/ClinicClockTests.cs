using DiaCompanion.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public class ClinicClockTests
{
    private readonly ClinicClock _sut = new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Clinic:TimeZone"] = "Asia/Ho_Chi_Minh"
        })
        .Build());

    [Fact(DisplayName = "TC-UNIT-ClinicClock-001 — UTC được đổi sang đúng giờ Việt Nam")]
    public void ToLocal_Converts_Utc_To_Vietnam_Time()
    {
        var utc = new DateTime(2026, 8, 16, 18, 30, 0, DateTimeKind.Utc);

        var local = _sut.ToLocal(utc);

        local.Should().Be(new DateTime(2026, 8, 17, 1, 30, 0));
        local!.Value.Kind.Should().Be(DateTimeKind.Unspecified);
    }

    [Fact(DisplayName = "TC-UNIT-ClinicClock-002 — Ngày địa phương không bị gom nhầm theo ngày UTC")]
    public void ToLocalDate_Uses_Vietnam_Calendar_Date()
    {
        var utc = new DateTime(2026, 8, 16, 18, 30, 0, DateTimeKind.Utc);

        _sut.ToLocalDate(utc).Should().Be(new DateOnly(2026, 8, 17));
    }

    [Fact(DisplayName = "TC-UNIT-ClinicClock-003 — Giờ Việt Nam được đổi ngược về UTC")]
    public void ToUtc_Converts_Vietnam_Time_To_Utc()
    {
        var local = new DateTime(2026, 8, 17, 1, 30, 0, DateTimeKind.Unspecified);

        _sut.ToUtc(local).Should().Be(
            new DateTime(2026, 8, 16, 18, 30, 0, DateTimeKind.Utc));
    }
}
