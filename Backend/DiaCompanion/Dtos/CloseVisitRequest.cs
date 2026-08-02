using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CloseVisitRequest
{
    [Required, MaxLength(2000)] public string Conclusion { get; set; } = "";
    public ReferralType Referral { get; set; } = ReferralType.None;
    /// <summary>Bỏ trống thì hệ thống suy từ mức DR đã xác nhận theo BR-19.</summary>
    public byte? RecheckMonths { get; set; }

    [Required]
    public string RowVersion { get; set; } = "";
}
