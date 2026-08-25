using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Moq;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public class AuditServiceTests
{
    private readonly Mock<IRepository> _repository = new(MockBehavior.Strict);
    private readonly Mock<ICurrentUser> _currentUser = new(MockBehavior.Strict);

    private AuditService Create()
    {
        _currentUser.SetupGet(user => user.Id).Returns(17);
        _currentUser.SetupGet(user => user.FullName).Returns("Bác sĩ Đỗ");
        _currentUser.SetupGet(user => user.Ip).Returns("10.0.0.7");
        return new AuditService(_repository.Object, _currentUser.Object);
    }

    [Fact(DisplayName = "TC-UNIT-AuditService-001 — Log chụp đủ người thao tác, dữ liệu cũ/mới và IP")]
    public async Task LogAsync_Adds_Complete_Audit_Record()
    {
        AuditLog? captured = null;
        _repository.Setup(repository => repository.Add(It.IsAny<AuditLog>()))
            .Callback<AuditLog>(value => captured = value);
        var sut = Create();

        await sut.LogAsync("UPDATE", "Patient", 23,
            oldValue: new { Name = "Cũ" },
            newValue: new { Name = "Mới" },
            detail: "Đổi tên");

        captured.Should().NotBeNull();
        captured!.UserId.Should().Be(17);
        captured.UserName.Should().Be("Bác sĩ Đỗ");
        captured.Action.Should().Be("UPDATE");
        captured.EntityType.Should().Be("Patient");
        captured.EntityId.Should().Be(23);
        captured.OldValue.Should().Be("{\"Name\":\"Cũ\"}");
        captured.NewValue.Should().Be("{\"Name\":\"Mới\"}");
        captured.Detail.Should().Be("Đổi tên");
        captured.IpAddress.Should().Be("10.0.0.7");
        captured.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(3));
    }

    [Fact(DisplayName = "EXT-L1-AuditService-NoCommit — Audit không tự commit, để cùng transaction nghiệp vụ")]
    public async Task LogAsync_Does_Not_Commit_Independently()
    {
        _repository.Setup(repository => repository.Add(It.IsAny<AuditLog>()));
        var sut = Create();

        await sut.LogAsync("READ", "Visit");

        _repository.Verify(repository => repository.CommitAsync(
            It.IsAny<CancellationToken>()), Times.Never);
        _repository.Verify(repository => repository.TryCommitAsync(
            It.IsAny<CancellationToken>()), Times.Never);
    }
}
