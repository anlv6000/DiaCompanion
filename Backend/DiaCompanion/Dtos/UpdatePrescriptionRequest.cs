using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Dtos;

public class UpdatePrescriptionRequest
{
    [MaxLength(1000)]
    public string? Note { get; set; }

    [Required]
    public string RowVersion { get; set; } = "";

    [Required, MinLength(1)]
    public List<UpdatePrescriptionItemRequest> Items { get; set; } = [];
}

public class UpdatePrescriptionItemRequest
{
    /// <summary>ID hiện có; gửi 0 để thêm dòng thuốc mới.</summary>
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string DrugName { get; set; } = "";

    [Required, MaxLength(100)]
    public string Dose { get; set; } = "";

    [Range(1, 6)]
    public byte TimesPerDay { get; set; }

    [Range(1, 365)]
    public int DurationDays { get; set; }

    [MaxLength(300)]
    public string? Instruction { get; set; }
}
