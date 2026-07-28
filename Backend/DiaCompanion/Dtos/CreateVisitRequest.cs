using System.ComponentModel.DataAnnotations;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Dtos;

public class CreateVisitRequest
{
    [Required] public int PatientId { get; set; }
    public int? DoctorId { get; set; }
}
