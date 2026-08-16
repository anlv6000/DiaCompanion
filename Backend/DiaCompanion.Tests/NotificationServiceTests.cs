using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Moq;
using DiaCompanion.Tests.Helpers;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public class NotificationServiceTests
{
    private readonly Mock<IRepository> _repository = new(MockBehavior.Strict);
    private readonly Mock<IClinicClock> _clock = new(MockBehavior.Strict);
    private readonly DateTime _now = new(2026, 8, 17, 3, 30, 0, DateTimeKind.Utc);

    private NotificationService Create()
    {
        _clock.SetupGet(clock => clock.UtcNow).Returns(_now);
        return new NotificationService(_repository.Object, _clock.Object);
    }

    [Fact(DisplayName = "TC-UNIT-NotificationService-001 — Push tạo thông báo đủ dữ liệu và hạn 90 ngày")]
    public void Push_Adds_Fully_Populated_Notification()
    {
        Notification? captured = null;
        _repository.Setup(repository => repository.Add(It.IsAny<Notification>()))
            .Callback<Notification>(value => captured = value);
        var sut = Create();

        var result = sut.Push(7, NotificationType.Result, "Có kết quả", "Mời xem kết quả",
            "Visit", 19);

        result.Should().BeSameAs(captured);
        result.UserId.Should().Be(7);
        result.Type.Should().Be(NotificationType.Result);
        result.Title.Should().Be("Có kết quả");
        result.Message.Should().Be("Mời xem kết quả");
        result.LinkEntity.Should().Be("Visit");
        result.LinkEntityId.Should().Be(19);
        result.CreatedAt.Should().Be(_now);
        result.ExpiresAt.Should().Be(_now.AddDays(90));
    }

    [Fact(DisplayName = "EXT-L1-NotificationService-NoLinkedUser — Bệnh nhân chưa liên kết tài khoản không nhận thông báo")]
    public void PushToPatient_Returns_Null_When_Patient_Has_No_User()
    {
        var sut = Create();

        var result = sut.PushToPatient(Build.Patient(userId: null), NotificationType.Recheck,
            "Tái khám", "Đã đến lịch");

        result.Should().BeNull();
        _repository.Verify(repository => repository.Add(It.IsAny<Notification>()), Times.Never);
    }

    [Fact(DisplayName = "TC-UNIT-NotificationService-002 — Bệnh nhân có tài khoản nhận thông báo theo user id")]
    public void PushToPatient_Uses_Linked_User_Id()
    {
        Notification? captured = null;
        _repository.Setup(repository => repository.Add(It.IsAny<Notification>()))
            .Callback<Notification>(value => captured = value);
        var sut = Create();

        var result = sut.PushToPatient(Build.Patient(userId: 81), NotificationType.Medication,
            "Nhắc thuốc", "Đến giờ uống thuốc");

        result.Should().NotBeNull();
        captured!.UserId.Should().Be(81);
    }
}
