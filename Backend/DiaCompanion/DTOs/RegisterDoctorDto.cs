namespace DiaCompanion.DTOs
{
    public class RegisterDoctorDto
    {
        // User
        public string FullName { get; set; } = null!;

        public string Email { get; set; } = null!;

        public string Password { get; set; } = null!;

        public string Gender { get; set; } = null!;

        public string PhoneNumber { get; set; } = null!;

        public DateTime Dob { get; set; }

        // Doctor
        public string Specialty { get; set; } = null!;

        public string LicenseNumber { get; set; } = null!;

        public string Department { get; set; } = null!;

        public string Hospital { get; set; } = null!;
    }
}