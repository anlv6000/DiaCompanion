using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class DoctorReplyRequest
{
    [Required, MaxLength(1000)] public string Reply { get; set; } = "";
}
