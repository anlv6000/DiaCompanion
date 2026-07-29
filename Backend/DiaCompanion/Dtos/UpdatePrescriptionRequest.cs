namespace DiaCompanion.Dtos
{
    public class UpdatePrescriptionRequest
    {
        public string? Note { get; set; }
        public List<UpdatePrescriptionItemRequest> Items { get; set; } = [];
    }

    public class UpdatePrescriptionItemRequest
    {
        public int Id { get; set; }

        public string DrugName { get; set; } = null!;

        public string Dose { get; set; } = null!;

        public byte TimesPerDay { get; set; }

        public int DurationDays { get; set; }

        public string? Instruction { get; set; }
    }
}
