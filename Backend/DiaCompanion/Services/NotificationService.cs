using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>
/// NF-10 / NF-11. Ghi thông báo vào CSDL để ứng dụng đọc khi mở.
/// PHẠM VI v1.0: chưa có hạ tầng đẩy (FCM/APNs) — thông báo hiển thị khi
/// bệnh nhân mở ứng dụng. Ghi rõ trong Report 3 để tránh mô tả quá năng lực thật.
/// </summary>
public interface INotificationService
{
    void Push(int userId, NotificationType type, string title, string message,
              string? linkEntity = null, int? linkEntityId = null);
    void PushToPatient(Patient patient, NotificationType type, string title, string message,
                       string? linkEntity = null, int? linkEntityId = null);
}

public class NotificationService : INotificationService
{
    private readonly IRepository _repository;
    public NotificationService(IRepository repository) => _repository = repository;

    public void Push(int userId, NotificationType type, string title, string message,
                     string? linkEntity = null, int? linkEntityId = null)
    {
        _repository.Notifications.Add(new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Message = message,
            LinkEntity = linkEntity,
            LinkEntityId = linkEntityId,
            CreatedAt = DateTime.UtcNow,
            // Archive sau 90 ngày để bảng không phình vô hạn
            ExpiresAt = DateTime.UtcNow.AddDays(90)
        });
    }

    public void PushToPatient(Patient patient, NotificationType type, string title, string message,
                              string? linkEntity = null, int? linkEntityId = null)
    {
        // Bệnh nhân chưa có tài khoản thì bỏ qua, không ném lỗi làm hỏng
        // giao dịch nghiệp vụ chính.
        if (patient.UserId is int uid) Push(uid, type, title, message, linkEntity, linkEntityId);
    }
}
