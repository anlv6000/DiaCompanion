using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Services;
using FluentAssertions;
using Moq;
using Xunit;

namespace DiaCompanion.Tests.Unit;

public class AdherenceServiceTests
{
    private readonly Mock<IRepository> _repository = new(MockBehavior.Strict);
    private readonly Mock<IClinicClock> _clock = new(MockBehavior.Strict);
    private readonly DateTime _localNow = new(2026, 8, 17, 6, 45, 0);

    [Fact(DisplayName = "TC-UNIT-AdherenceService-001 — Sinh đủ lịch theo số lần uống và số ngày")]
    public void GenerateSchedule_Creates_All_Doses_In_Clinic_Time()
    {
        var logs = new List<MedicationLog>();
        _clock.SetupGet(clock => clock.LocalNow).Returns(_localNow);
        _clock.Setup(clock => clock.ToUtc(It.IsAny<DateTime>()))
            .Returns<DateTime>(local => DateTime.SpecifyKind(local.AddHours(-7), DateTimeKind.Utc));
        _repository.Setup(repository => repository.Add(It.IsAny<MedicationLog>()))
            .Callback<MedicationLog>(logs.Add);
        var sut = new AdherenceService(_repository.Object, _clock.Object);
        var prescription = new Prescription { PatientId = 31 };
        var item = new PrescriptionItem { Id = 5, TimesPerDay = 2, DurationDays = 2, IsActive = true };

        sut.GenerateSchedule(prescription, new[] { item });

        logs.Should().HaveCount(4);
        logs.Should().OnlyContain(log => log.PatientId == 31
            && log.PrescriptionItemId == 5
            && log.Status == MedicationStatus.Pending);
        logs.Select(log => log.ScheduledLocalDate).Should().BeEquivalentTo(
    new[]
    {
        new DateOnly(2026, 8, 17),
        new DateOnly(2026, 8, 17),
        new DateOnly(2026, 8, 18),
        new DateOnly(2026, 8, 18)
    });

        logs.Select(log => log.ScheduledAt.Hour).Should().BeEquivalentTo(
            new[] { 1, 13, 1, 13 });
    }

    [Fact(DisplayName = "EXT-L1-AdherenceService-InactiveItem — Thuốc đã ngừng không sinh lịch nhắc")]
    public void GenerateSchedule_Ignores_Inactive_Items()
    {
        _clock.SetupGet(clock => clock.LocalNow).Returns(_localNow);
        var sut = new AdherenceService(_repository.Object, _clock.Object);

        sut.GenerateSchedule(new Prescription { PatientId = 1 }, new[]
        {
            new PrescriptionItem { Id = 2, TimesPerDay = 3, DurationDays = 7, IsActive = false }
        });

        _repository.Verify(repository => repository.Add(It.IsAny<MedicationLog>()), Times.Never);
    }

    [Fact(DisplayName = "EXT-L1-AdherenceService-FrequencyFallback — Số lần uống ngoài cấu hình dùng lịch an toàn một lần lúc 08:00")]
    public void GenerateSchedule_Uses_Safe_Fallback_For_Unknown_Frequency()
    {
        MedicationLog? captured = null;
        _clock.SetupGet(clock => clock.LocalNow).Returns(_localNow);
        _clock.Setup(clock => clock.ToUtc(It.IsAny<DateTime>()))
            .Returns<DateTime>(value => value);
        _repository.Setup(repository => repository.Add(It.IsAny<MedicationLog>()))
            .Callback<MedicationLog>(value => captured = value);
        var sut = new AdherenceService(_repository.Object, _clock.Object);

        sut.GenerateSchedule(new Prescription { PatientId = 8 }, new[]
        {
            new PrescriptionItem { Id = 9, TimesPerDay = 9, DurationDays = 1, IsActive = true }
        });

        captured.Should().NotBeNull();
        captured!.ScheduledAt.Hour.Should().Be(8);
        _repository.Verify(repository => repository.Add(It.IsAny<MedicationLog>()), Times.Once);
    }

    [Theory(DisplayName = "TC-UNIT-AdherenceService-003 — Số ngày ngoài 1–3650 bị từ chối")]
    [InlineData(0)]
    [InlineData(3651)]
    public async Task GetAsync_Rejects_Days_Outside_Allowed_Range(int days)
    {
        var sut = new AdherenceService(_repository.Object, _clock.Object);

        var act = async () => await sut.GetAsync(1, days);

        (await act.Should().ThrowAsync<AppException>())
            .Which.MessageCode.Should().Be(Msg.InvalidData);
    }

    [Fact(DisplayName = "TC-UNIT-AdherenceService-004 — Khoảng ngày đảo ngược bị từ chối")]
    public async Task GetAsync_Rejects_From_After_To()
    {
        var sut = new AdherenceService(_repository.Object, _clock.Object);

        var act = async () => await sut.GetAsync(1, from: new DateOnly(2026, 8, 18),
            to: new DateOnly(2026, 8, 17));

        (await act.Should().ThrowAsync<AppException>())
            .Which.MessageCode.Should().Be(Msg.InvalidData);
    }

    [Fact(DisplayName = "TC-UNIT-AdherenceService-002 — Tổng hợp trạng thái và tỉ lệ chỉ trên liều đã đến hạn")]
    public async Task GetAsync_Calculates_Counts_And_Rounded_Rate()
    {
        var today = new DateOnly(2026, 8, 17);
        _clock.SetupGet(clock => clock.LocalToday).Returns(today);
        var statuses = new[]
        {
            MedicationStatus.Taken, MedicationStatus.Taken,
            MedicationStatus.Missed, MedicationStatus.Skipped,
            MedicationStatus.Pending
        };
        _repository.Setup(repository => repository.GetMedicationStatusesAsync(
                44, today.AddDays(-6), today, 12, It.IsAny<CancellationToken>()))
            .ReturnsAsync(statuses);
        var sut = new AdherenceService(_repository.Object, _clock.Object);

        var result = await sut.GetAsync(44, days: 7, prescriptionId: 12);

        result.Should().Be(new AdherenceSummary(
            Total: 5, Taken: 2, Missed: 1, Skipped: 1, Pending: 1, Rate: 50.0m));
    }

    [Fact(DisplayName = "EXT-L1-AdherenceService-NoDueDose — Chưa có liều đến hạn thì tỉ lệ bằng 0")]
    public async Task GetAsync_Returns_Zero_Rate_When_No_Dose_Is_Due()
    {
        var today = new DateOnly(2026, 8, 17);
        _clock.SetupGet(clock => clock.LocalToday).Returns(today);
        _repository.Setup(repository => repository.GetMedicationStatusesAsync(
                1, today, today, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { MedicationStatus.Pending, MedicationStatus.Pending });
        var sut = new AdherenceService(_repository.Object, _clock.Object);

        var result = await sut.GetAsync(1, days: 1);

        result.Total.Should().Be(2);
        result.Pending.Should().Be(2);
        result.Rate.Should().Be(0m);
    }
}
