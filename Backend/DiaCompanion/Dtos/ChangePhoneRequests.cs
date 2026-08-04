using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class RequestPhoneChangeOtpRequest
{
    [Required, MaxLength(20)]
    public string NewPhone { get; set; } = "";
}

public class ConfirmPhoneChangeRequest
{
    [Required, MaxLength(20)]
    public string NewPhone { get; set; } = "";

    [Required, StringLength(6, MinimumLength = 6)]
    public string Code { get; set; } = "";

    [Required]
    public string RowVersion { get; set; } = "";
}
