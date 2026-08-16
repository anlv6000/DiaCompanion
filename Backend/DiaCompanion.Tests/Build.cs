using DiaCompanion.Api.Common;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Tests.Helpers;

/// <summary>
/// Bộ dựng dữ liệu dùng chung cho unit test.
///
/// Lý do tồn tại: hầu hết ca kiểm thử chỉ quan tâm MỘT trường (vai trò sai,
/// bản ghi đã void, rowVersion cũ…). Nếu mỗi ca tự dựng cả thực thể thì ý định
/// của ca bị chôn dưới hai chục dòng gán giá trị, và khi thực thể đổi thì phải
/// sửa hàng trăm chỗ. Ở đây mỗi hàm trả về một bản ghi HỢP LỆ, ca kiểm thử chỉ
/// sửa đúng trường mình đang thử.
/// </summary>
public static class Build
{
    public static User User(
        int id = 1,
        string phone = "0900000001",
        string? email = "staff@hospital.test",
        bool mustChangePassword = false)
        => new()
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            FullName = "Nguyen Van A",
            Phone = phone,
            Email = email,
            PasswordHash = "hashed",
            MustChangePassword = mustChangePassword,
            CreatedAt = DateTime.UtcNow,
            RowVer = RowVersion(1),
        };

    public static Patient Patient(
        int id = 1,
        string code = "BN20260001",
        int? userId = 1,
        bool isVoided = false)
        => new()
        {
            Id = id,
            Code = code,
            FullName = "Tran Thi B",
            Phone = "0900000002",
            UserId = userId,
            IsVoided = isVoided,
            CreatedAt = DateTime.UtcNow,
            RowVer = RowVersion(1),
        };

    public static FundusImage FundusImage(
        int id = 1,
        int? visitId = 1,
        Eye eye = Eye.Od,
        QualityStatus quality = QualityStatus.Gradable,
        bool isVoided = false)
        => new()
        {
            Id = id,
            VisitId = visitId,
            PatientId = 1,
            Eye = eye,
            QualityStatus = quality,
            FilePath = $"fundus/2026/BN20260001/v{visitId}_{Guid.NewGuid():N}.jpg",
            IsVoided = isVoided,
            CreatedAt = DateTime.UtcNow,
            RowVer = RowVersion(1),
        };

    public static ModelVersion ModelVersion(
        ModelType type = ModelType.Dr,
        bool isActive = true,
        decimal? qwk = 0.8365m)
        => new()
        {
            Id = (int)type,
            ModelType = type,
            Name = $"{type}-v1.0",
            FilePath = $"{type.ToString().ToLowerInvariant()}/v1.0/weights.bin",
            Sha256 = new string('a', 64),
            Qwk = qwk,
            IsActive = isActive,
            WasActivated = isActive,
            CreatedAt = DateTime.UtcNow,
            RowVer = RowVersion(1),
        };

    /// <summary>
    /// rowversion của SQL Server là 8 byte. Dùng số thứ tự để dựng được hai giá
    /// trị khác nhau một cách tường minh khi kiểm thử xung đột đồng thời.
    /// </summary>
    public static byte[] RowVersion(long version)
        => BitConverter.GetBytes(version).Reverse().ToArray();

    public static string RowVersionBase64(long version)
        => Convert.ToBase64String(RowVersion(version));
}
