using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Api.Dtos;

public class RefreshTokenRequest
{
    [Required] public string RefreshToken { get; set; } = "";
}
