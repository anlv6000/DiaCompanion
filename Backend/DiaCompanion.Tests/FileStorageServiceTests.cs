using System.Security.Cryptography;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public sealed class FileStorageServiceTests : IDisposable
{
    private readonly string _tempRoot = Path.Combine(
        Path.GetTempPath(), $"DiaCompanionTests_{Guid.NewGuid():N}");

    private FileStorageService Create(long maxBytes = 1024)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:FundusRoot"] = Path.Combine(_tempRoot, "fundus"),
                ["Storage:MaxUploadBytes"] = maxBytes.ToString(),
                ["Storage:AllowedExtensions:0"] = ".jpg",
                ["Storage:AllowedExtensions:1"] = ".png"
            })
            .Build();
        return new FileStorageService(config);
    }

    [Fact(DisplayName = "TC-UNIT-FileStorageService-001 — Exists phản ánh đúng trạng thái tệp")]
    public void Exists_Returns_True_Only_For_Existing_File()
    {
        var sut = Create();

        sut.Exists("fundus/missing.jpg").Should().BeFalse();
    }

    [Fact(DisplayName = "TC-UNIT-FileStorageService-002 — Exists chặn path traversal")]
    public void Exists_Rejects_Path_Traversal()
    {
        var sut = Create();
        var act = () => sut.Exists("../secret.txt");

        act.Should().Throw<AppException>()
            .Which.MessageCode.Should().Be(Msg.Forbidden);
    }

    [Fact(DisplayName = "TC-UNIT-FileStorageService-003 — OpenRead đọc đúng nội dung tệp đã lưu")]
    public async Task OpenRead_Returns_Saved_Content()
    {
        var sut = Create();
        var bytes = new byte[] { 1, 2, 3, 4 };
        var stored = await sut.SaveFundusAsync(
            new MemoryStream(bytes), "eye.jpg", "BN001", 7);

        using var stream = sut.OpenRead(stored.RelativePath);
        using var copy = new MemoryStream();
        await stream.CopyToAsync(copy);
        copy.ToArray().Should().Equal(bytes);
    }

    [Fact(DisplayName = "TC-UNIT-FileStorageService-004 — OpenRead trả MSG-24 khi tệp không tồn tại")]
    public void OpenRead_Throws_NotFound_For_Missing_File()
    {
        var sut = Create();
        var act = () => sut.OpenRead("fundus/missing.jpg");

        act.Should().Throw<AppException>()
            .Which.MessageCode.Should().Be(Msg.LoadFailed);
    }

    [Fact(DisplayName = "TC-UNIT-FileStorageService-005 — SaveFundus lưu checksum và đường dẫn tương đối")]
    public async Task SaveFundusAsync_Saves_File_And_Computes_Sha256()
    {
        var sut = Create();
        var bytes = new byte[] { 10, 20, 30 };

        var stored = await sut.SaveFundusAsync(
            new MemoryStream(bytes), "retina.PNG", "BN/001", 9);

        stored.RelativePath.Should().StartWith("fundus/");
        stored.RelativePath.Should().EndWith(".png");
        stored.RelativePath.Should().NotContain("BN/");
        stored.SizeBytes.Should().Be(bytes.Length);
        stored.Sha256.Should().Be(
            Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
        sut.Exists(stored.RelativePath).Should().BeTrue();
    }

    [Fact(DisplayName = "TC-UNIT-FileStorageService-006 — SaveFundus chặn định dạng ngoài danh sách")]
    public async Task SaveFundusAsync_Rejects_Disallowed_Extension()
    {
        var sut = Create();
        var act = async () => await sut.SaveFundusAsync(
            new MemoryStream(new byte[] { 1 }), "payload.exe", "BN001", 1);

        (await act.Should().ThrowAsync<AppException>())
            .Which.MessageCode.Should().Be(Msg.BadFileType);
    }

    [Fact(DisplayName = "TC-UNIT-FileStorageService-007 — SaveFundus chặn tệp vượt giới hạn")]
    public async Task SaveFundusAsync_Rejects_Oversized_File()
    {
        var sut = Create(maxBytes: 2);
        var act = async () => await sut.SaveFundusAsync(
            new MemoryStream(new byte[] { 1, 2, 3 }), "eye.jpg", "BN001", 1);

        (await act.Should().ThrowAsync<AppException>())
            .Which.MessageCode.Should().Be(Msg.FileTooLarge);
    }

    [Fact(DisplayName = "TC-UNIT-FileStorageService-008 — SaveFundus chặn tệp rỗng")]
    public async Task SaveFundusAsync_Rejects_Empty_File()
    {
        var sut = Create();
        var act = async () => await sut.SaveFundusAsync(
            new MemoryStream(), "eye.jpg", "BN001", 1);

        (await act.Should().ThrowAsync<AppException>())
            .Which.MessageCode.Should().Be(Msg.BadFileType);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot))
            Directory.Delete(_tempRoot, recursive: true);
    }
}
