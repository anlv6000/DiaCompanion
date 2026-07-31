using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CreateStaffRequest
{
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required, MaxLength(200)] public string FullName { get; set; } = "";
    [Required] public UserRole Role { get; set; }
    /// <summary>BR-10: bắt buộc khi Role = Doctor.</summary>
    public string? LicenseNo { get; set; }
}
