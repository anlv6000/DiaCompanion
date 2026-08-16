using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace DiaCompanion.Tests.Unit;

/// <summary>
/// Kiểm thử OTP tập trung vào single-use, giới hạn thử, hết hạn và thứ tự
/// lưu trước khi gửi SMS. Mã OTP thật vẫn do RNG của production sinh ra.
/// </summary>
public class OtpServiceTests
{
    private readonly Mock<IRepository> _repository = new(MockBehavior.Strict);
    private readonly Mock<IPasswordHasher> _hasher = new(MockBehavior.Strict);
    private readonly Mock<IConfigService> _config = new(MockBehavior.Strict);
    private readonly Mock<ISmsSender> _sms = new(MockBehavior.Strict);
    private readonly Mock<ILogger<OtpService>> _logger = new();

    private OtpService Create() => new(
        _repository.Object, _hasher.Object, _config.Object, _sms.Object, _logger.Object);

    [Theory(DisplayName = "EXT-L1-OtpService-BlankPhone — Không cấp OTP khi số điện thoại trống")]
    [InlineData("")]
    [InlineData("   ")]
    public async Task IssueAsync_Rejects_Blank_Phone(string phone)
    {
        var act = async () => await Create().IssueAsync(phone, OtpPurpose.Login, null);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact(DisplayName = "TC-UNIT-OtpService-001 — Cấp OTP vô hiệu mã cũ, lưu hash rồi mới gửi SMS")]
    public async Task IssueAsync_Invalidates_Old_Code_Persists_Hash_And_Sends_Message()
    {
        var old = new OtpCode { Phone = "0900000001", Purpose = OtpPurpose.Login };
        OtpCode? captured = null;
        var sequence = new MockSequence();

        _config.Setup(config => config.GetIntAsync(ConfigKeys.OtpTtlSeconds, 300))
            .ReturnsAsync(120);
        _repository.Setup(repository => repository.GetUnconsumedOtpCodesAsync(
                "0900000001", OtpPurpose.Login, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { old });
        _hasher.Setup(hasher => hasher.Hash(It.Is<string>(code =>
                code.Length == 6 && code.All(char.IsDigit))))
            .Returns("otp-hash");
        _repository.Setup(repository => repository.Add(It.IsAny<OtpCode>()))
            .Callback<OtpCode>(value => captured = value);
        _repository.InSequence(sequence)
            .Setup(repository => repository.CommitAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _sms.InSequence(sequence)
            .Setup(sender => sender.SendAsync(
                "0900000001",
                It.Is<string>(message => message.Contains("Ma OTP cua ban la")
                    && message.Contains("2 phut")),
                "otp-login",
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var before = DateTime.UtcNow;
        var code = await Create().IssueAsync(" 0900000001 ", OtpPurpose.Login, issuedBy: 9);

        code.Should().MatchRegex("^[0-9]{6}$");
        old.ConsumedAt.Should().NotBeNull();
        captured.Should().NotBeNull();
        captured!.Phone.Should().Be("0900000001");
        captured.CodeHash.Should().Be("otp-hash");
        captured.Purpose.Should().Be(OtpPurpose.Login);
        captured.IssuedBy.Should().Be(9);
        captured.ExpiresAt.Should().BeCloseTo(before.AddSeconds(120), TimeSpan.FromSeconds(3));
    }

    [Fact(DisplayName = "EXT-L1-OtpService-SmsFailure — Gửi SMS lỗi vẫn giữ OTP đã commit và báo lỗi caller")]
    public async Task IssueAsync_Propagates_Sms_Error_After_Commit()
    {
        _config.Setup(config => config.GetIntAsync(ConfigKeys.OtpTtlSeconds, 300))
            .ReturnsAsync(300);
        _repository.Setup(repository => repository.GetUnconsumedOtpCodesAsync(
                "0900000002", OtpPurpose.ResetPassword, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<OtpCode>());
        _hasher.Setup(hasher => hasher.Hash(It.IsAny<string>())).Returns("hash");
        _repository.Setup(repository => repository.Add(It.IsAny<OtpCode>()));
        _repository.Setup(repository => repository.CommitAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _sms.Setup(sender => sender.SendAsync(
                "0900000002", It.IsAny<string>(), "otp-resetpassword",
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("gateway unavailable"));

        var act = async () => await Create().IssueAsync(
            "0900000002", OtpPurpose.ResetPassword, null);

        await act.Should().ThrowAsync<InvalidOperationException>();
        _repository.Verify(repository => repository.CommitAsync(
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory(DisplayName = "EXT-L1-OtpService-BlankVerify — Xác minh thiếu số điện thoại hoặc mã trả false ngay")]
    [InlineData("", "123456")]
    [InlineData("0900000001", " ")]
    public async Task VerifyAsync_Returns_False_For_Blank_Input(string phone, string code)
    {
        (await Create().VerifyAsync(phone, code, OtpPurpose.Login)).Should().BeFalse();
    }

    [Fact(DisplayName = "EXT-L1-OtpService-NoCode — Không có OTP còn hiệu lực thì xác minh thất bại")]
    public async Task VerifyAsync_Returns_False_When_No_Code_Exists()
    {
        _config.Setup(config => config.GetIntAsync(ConfigKeys.OtpMaxAttempts, 5))
            .ReturnsAsync(5);
        _repository.Setup(repository => repository.GetLatestUnconsumedOtpAsync(
                "0900000001", OtpPurpose.Login, It.IsAny<CancellationToken>()))
            .ReturnsAsync((OtpCode?)null);

        var result = await Create().VerifyAsync(" 0900000001 ", "123456", OtpPurpose.Login);

        result.Should().BeFalse();
    }

    [Fact(DisplayName = "EXT-L1-OtpService-Expired — OTP hết hạn bị consume và commit")]
    public async Task VerifyAsync_Consumes_Expired_Code()
    {
        var otp = new OtpCode { ExpiresAt = DateTime.UtcNow.AddSeconds(-1), CodeHash = "hash" };
        SetupVerificationLookup(otp, maxAttempts: 5);
        _repository.Setup(repository => repository.CommitAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var result = await Create().VerifyAsync("0900000001", "123456", OtpPurpose.Login);

        result.Should().BeFalse();
        otp.ConsumedAt.Should().NotBeNull();
        _hasher.Verify(hasher => hasher.Verify(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact(DisplayName = "EXT-L1-OtpService-AttemptLimit — OTP đạt giới hạn thử bị khóa trước khi so hash")]
    public async Task VerifyAsync_Consumes_Code_At_Attempt_Limit()
    {
        var otp = new OtpCode
        {
            ExpiresAt = DateTime.UtcNow.AddMinutes(2), CodeHash = "hash", AttemptCount = 3
        };
        SetupVerificationLookup(otp, maxAttempts: 3);
        _repository.Setup(repository => repository.CommitAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var result = await Create().VerifyAsync("0900000001", "123456", OtpPurpose.Login);

        result.Should().BeFalse();
        otp.ConsumedAt.Should().NotBeNull();
        otp.AttemptCount.Should().Be(3);
        _hasher.Verify(hasher => hasher.Verify(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact(DisplayName = "EXT-L1-OtpService-WrongCode — Sai OTP tăng số lần thử nhưng chưa consume")]
    public async Task VerifyAsync_Increments_Attempt_For_Wrong_Code()
    {
        var otp = new OtpCode
        {
            ExpiresAt = DateTime.UtcNow.AddMinutes(2), CodeHash = "hash", AttemptCount = 1
        };
        SetupVerificationLookup(otp, maxAttempts: 5);
        _hasher.Setup(hasher => hasher.Verify("000000", "hash")).Returns(false);
        _repository.Setup(repository => repository.CommitAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var result = await Create().VerifyAsync("0900000001", " 000000 ", OtpPurpose.Login);

        result.Should().BeFalse();
        otp.AttemptCount.Should().Be(2);
        otp.ConsumedAt.Should().BeNull();
    }

    [Fact(DisplayName = "TC-UNIT-OtpService-002 — Đúng OTP chỉ dùng một lần và được commit")]
    public async Task VerifyAsync_Consumes_Valid_Code()
    {
        var otp = new OtpCode
        {
            ExpiresAt = DateTime.UtcNow.AddMinutes(2), CodeHash = "hash", AttemptCount = 0
        };
        SetupVerificationLookup(otp, maxAttempts: 5);
        _hasher.Setup(hasher => hasher.Verify("123456", "hash")).Returns(true);
        _repository.Setup(repository => repository.CommitAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var result = await Create().VerifyAsync("0900000001", "123456", OtpPurpose.Login);

        result.Should().BeTrue();
        otp.AttemptCount.Should().Be(1);
        otp.ConsumedAt.Should().NotBeNull();
        _repository.Verify(repository => repository.CommitAsync(
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private void SetupVerificationLookup(OtpCode otp, int maxAttempts)
    {
        _config.Setup(config => config.GetIntAsync(ConfigKeys.OtpMaxAttempts, 5))
            .ReturnsAsync(maxAttempts);
        _repository.Setup(repository => repository.GetLatestUnconsumedOtpAsync(
                "0900000001", OtpPurpose.Login, It.IsAny<CancellationToken>()))
            .ReturnsAsync(otp);
    }
}
