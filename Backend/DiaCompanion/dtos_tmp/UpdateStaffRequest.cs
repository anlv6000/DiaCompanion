using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class UpdateStaffRequest
{
    [Required, MaxLength(200)] public string FullName { get; set; } = "";
    public string? LicenseNo { get; set; }
}
