using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Entities;

public class User : IHasRowVersion
{
    public int Id { get; set; }                       // QT-1: INT IDENTITY, không dùng GUID clustered
    public Guid PublicId { get; set; } = Guid.NewGuid();

    /// <summary>Định danh đăng nhập của bệnh nhân (LI-6). Unique CÓ ĐIỀU KIỆN.</summary>
    [MaxLength(20)] public string? Phone { get; set; }
    [MaxLength(256)] public string? Email { get; set; }

    [Required, MaxLength(256)] public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; }
    [Required, MaxLength(200)] public string FullName { get; set; } = "";

    /// <summary>BR-10: bắt buộc với vai trò Bác sĩ, cưỡng chế bằng CK_Users_License.</summary>
    [MaxLength(50)] public string? LicenseNo { get; set; }

    /// <summary>Mật khẩu tạm in ra phiếu phải đổi ở lần đăng nhập đầu.</summary>
    public bool MustChangePassword { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Patient? Patient { get; set; }

    public byte[] RowVer { get; set; } = Array.Empty<byte>();
}
