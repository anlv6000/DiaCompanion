using DiaCompanion.Api.Common;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public class PasswordHasherTests
{
    private readonly PasswordHasher _sut = new();

    [Theory(DisplayName = "TC-UNIT-PasswordHasher-001 — Mật khẩu mạnh vượt qua kiểm tra")]
    [InlineData("Doctor123")]
    [InlineData("abc12345")]
    public void EnsureStrong_Accepts_Eight_Characters_With_Letter_And_Digit(string password)
    {
        var act = () => _sut.EnsureStrong(password);

        act.Should().NotThrow();
    }

    [Theory(DisplayName = "TC-UNIT-PasswordHasher-002 — Mật khẩu yếu trả MSG-07")]
    [InlineData("abc123")]
    [InlineData("abcdefgh")]
    [InlineData("12345678")]
    public void EnsureStrong_Rejects_Weak_Password(string password)
    {
        var act = () => _sut.EnsureStrong(password);

        var error = act.Should().Throw<AppException>().Which;
        error.MessageCode.Should().Be(Msg.WeakPassword);
        error.StatusCode.Should().Be(400);
    }

    [Fact(DisplayName = "TC-UNIT-PasswordHasher-003 — Mật khẩu tạm luôn có sáu chữ số")]
    public void GenerateTempPassword_Returns_Six_Digits()
    {
        var password = _sut.GenerateTempPassword();

        password.Should().MatchRegex("^[0-9]{6}$");
    }

    [Fact(DisplayName = "TC-UNIT-PasswordHasher-004 — Hash dùng PBKDF2 SHA-256 và salt riêng")]
    public void Hash_Uses_Expected_Format_And_Random_Salt()
    {
        var first = _sut.Hash("Doctor123");
        var second = _sut.Hash("Doctor123");

        first.Should().StartWith("PBKDF2$100000$");
        first.Split('$').Should().HaveCount(4);
        first.Should().NotBe(second);
    }

    [Fact(DisplayName = "TC-UNIT-PasswordHasher-005 — Verify chỉ chấp nhận đúng mật khẩu")]
    public void Verify_Accepts_Correct_And_Rejects_Wrong_Password()
    {
        var stored = _sut.Hash("Doctor123");

        _sut.Verify("Doctor123", stored).Should().BeTrue();
        _sut.Verify("Wrong123", stored).Should().BeFalse();
        _sut.Verify("Doctor123", "invalid-format").Should().BeFalse();
    }
}
