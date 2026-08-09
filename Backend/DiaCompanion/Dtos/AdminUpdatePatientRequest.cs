namespace DiaCompanion.Dtos
{
    public class AdminUpdatePatientRequest
    {
        public string FullName { get; set; } = string.Empty;

        public byte Gender { get; set; }

        public string? Address { get; set; }

        public string RowVersion { get; set; } = string.Empty;

        // Có thể null nếu Patient chưa có User.
        public string? AccountRowVersion { get; set; }
    }
}
