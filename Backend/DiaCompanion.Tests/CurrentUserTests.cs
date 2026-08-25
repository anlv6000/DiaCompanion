using System.Security.Claims;
using DiaCompanion.Api.Common;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public class CurrentUserTests
{
    private static CurrentUser Create(params Claim[] claims)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"))
        };
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("10.1.2.3");
        return new CurrentUser(new HttpContextAccessor { HttpContext = context });
    }

    [Fact(DisplayName = "EXT-L1-CurrentUser-001 — Claims được ánh xạ đúng sang người dùng hiện tại")]
    public void Claims_Are_Mapped_To_Current_User_Properties()
    {
        var sut = Create(
            new Claim(ClaimTypes.NameIdentifier, "17"),
            new Claim("fullName", "Nguyễn Văn A"),
            new Claim("patientId", "31"),
            new Claim(ClaimTypes.Role, "Doctor"),
            new Claim(ClaimTypes.Role, "doctor"),
            new Claim(ClaimTypes.Role, "Admin"));

        sut.Id.Should().Be(17);
        sut.FullName.Should().Be("Nguyễn Văn A");
        sut.PatientId.Should().Be(31);
        sut.Roles.Should().BeEquivalentTo("Doctor", "Admin");
        sut.Ip.Should().Be("10.1.2.3");
    }

    [Theory(DisplayName = "EXT-L1-CurrentUser-002 — So khớp vai trò không phân biệt hoa thường")]
    [InlineData("doctor", true)]
    [InlineData("ADMIN", true)]
    [InlineData("Reception", false)]
    public void IsInRole_Is_Case_Insensitive(string role, bool expected)
    {
        var sut = Create(
            new Claim(ClaimTypes.Role, "Doctor"),
            new Claim(ClaimTypes.Role, "Admin"));

        sut.IsInRole(role).Should().Be(expected);
    }

    [Fact(DisplayName = "EXT-L1-CurrentUser-003 — Một vai trò khớp trong danh sách yêu cầu là đủ")]
    public void IsInRole_Accepts_Any_Requested_Role()
    {
        var sut = Create(new Claim(ClaimTypes.Role, "Doctor"));

        sut.IsInRole("Admin", "Doctor").Should().BeTrue();
        sut.IsInRole().Should().BeFalse();
    }

    [Fact(DisplayName = "EXT-L1-CurrentUser-004 — RequireId trả id khi phiên hợp lệ")]
    public void RequireId_Returns_Authenticated_User_Id()
    {
        Create(new Claim(ClaimTypes.NameIdentifier, "28"))
            .RequireId().Should().Be(28);
    }

    [Fact(DisplayName = "EXT-L1-CurrentUser-005 — RequireId báo phiên hết hạn khi thiếu định danh")]
    public void RequireId_Throws_Unauthorized_When_Identity_Is_Missing()
    {
        var act = () => Create().RequireId();

        var error = act.Should().Throw<AppException>().Which;
        error.MessageCode.Should().Be(Msg.SessionExpired);
        error.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }
}
