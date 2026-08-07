using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class UpdateStaffRequest
{
    [Required, MaxLength(200)] public string FullName { get; set; } = "";
    public string? LicenseNo { get; set; }
    public List<string>? Roles { get; set; }
    [Required] public string RowVersion { get; set; } = "";
}
