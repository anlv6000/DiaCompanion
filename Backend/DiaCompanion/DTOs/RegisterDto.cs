namespace DiaCompanion.DTOs
{
    public class RegisterDto
    {
        public string FullName { get; set; } = null!;

        public string Email { get; set; } = null!;

        public string Password { get; set; } = null!;

        public string Gender { get; set; } = null!;

        public DateTime Dob { get; set; }


    }
}
