using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using DiaCompanion.Tests.Helpers;
using Xunit;

namespace DiaCompanion.Tests.Unit;

/// <summary>
/// Kiểm thử token ở đúng biên bảo mật: claim, thời hạn, loại token và chữ ký.
/// Không mock JwtSecurityTokenHandler vì chính việc ký/xác minh là hành vi cần thử.
/// </summary>
public class JwtTokenServiceTests
{
    private static JwtTokenService Create(int accessMinutes = 15, int refreshDays = 7)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SigningKey"] = "test-only-signing-key-with-at-least-thirty-two-bytes-2026",
                ["Jwt:Issuer"] = "DiaCompanion.Tests",
                ["Jwt:Audience"] = "DiaCompanion.Tests.Client",
                ["Jwt:ExpiryMinutes"] = accessMinutes.ToString(),
                ["Jwt:RefreshExpiryDays"] = refreshDays.ToString()
            })
            .Build();

        return new JwtTokenService(configuration);
    }

    [Fact(DisplayName = "TC-UNIT-JwtTokenService-001 — Access token chứa đủ định danh và claim nghiệp vụ")]
    public void CreateAccessToken_Writes_Identity_And_Business_Claims()
    {
        var sut = Create();
        var user = Build.User(id: 17, mustChangePassword: true);

        var token = sut.CreateAccessToken(
            user, new[] { "Doctor", "doctor", "Admin" }, patientId: 23, out _);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        jwt.Claims.Should().Contain(c =>
            (c.Type == ClaimTypes.NameIdentifier || c.Type == "nameid") && c.Value == "17");
        jwt.Claims.Should().Contain(c => c.Type == "fullName" && c.Value == user.FullName);
        jwt.Claims.Should().Contain(c => c.Type == "token_type" && c.Value == "access");
        jwt.Claims.Should().Contain(c => c.Type == "patientId" && c.Value == "23");
        jwt.Claims.Should().Contain(c => c.Type == "mustChangePassword" && c.Value == "true");
        jwt.Claims.Where(c => c.Type == ClaimTypes.Role || c.Type == "role")
            .Select(c => c.Value)
            .Should().BeEquivalentTo("Doctor", "Admin");
    }

    [Fact(DisplayName = "EXT-L1-JwtTokenService-AccessExpiry — Access token tôn trọng thời hạn cấu hình")]
    public void CreateAccessToken_Uses_Configured_Expiry()
    {
        var sut = Create(accessMinutes: 12);
        var before = DateTime.UtcNow.AddMinutes(12);

        _ = sut.CreateAccessToken(Build.User(), new[] { "Doctor" }, null, out var expiresAt);

        expiresAt.Should().BeCloseTo(before, TimeSpan.FromSeconds(3));
    }

    [Fact(DisplayName = "TC-UNIT-JwtTokenService-002 — Refresh token chứa đúng loại, định danh và thời hạn")]
    public void CreateRefreshToken_Writes_Expected_Claims_And_Expiry()
    {
        var sut = Create(refreshDays: 3);

        var token = sut.CreateRefreshToken(91, out var expiresAt);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        jwt.Claims.Should().Contain(c => c.Type == "token_type" && c.Value == "refresh");
        jwt.Claims.Should().Contain(c =>
            (c.Type == ClaimTypes.NameIdentifier || c.Type == "nameid") && c.Value == "91");
        expiresAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(3), TimeSpan.FromSeconds(3));
    }

    [Fact(DisplayName = "TC-UNIT-JwtTokenService-003 — Refresh token hợp lệ trả đúng user id")]
    public void ValidateRefreshToken_Accepts_Token_Signed_By_The_Service()
    {
        var sut = Create(refreshDays: 3);
        var token = sut.CreateRefreshToken(91, out var expiresAt);

        sut.ValidateRefreshToken(token).Should().Be(91);
        expiresAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(3), TimeSpan.FromSeconds(3));
    }

    [Fact(DisplayName = "EXT-L1-JwtTokenService-RejectAccess — Access token không được dùng thay refresh token")]
    public void ValidateRefreshToken_Rejects_Access_Token()
    {
        var sut = Create();
        var token = sut.CreateAccessToken(Build.User(), new[] { "Patient" }, 1, out _);

        sut.ValidateRefreshToken(token).Should().BeNull();
    }

    [Theory(DisplayName = "EXT-L1-JwtTokenService-RejectInvalid — Refresh token rỗng hoặc sai định dạng bị từ chối")]
    [InlineData("")]
    [InlineData("not-a-jwt")]
    public void ValidateRefreshToken_Rejects_Invalid_Input(string token)
    {
        Create().ValidateRefreshToken(token).Should().BeNull();
    }
}
