using System.ComponentModel.DataAnnotations;

namespace DiaCompanion.Dtos
{
    public class AdminUpdatePatientRequest
    {

        [MaxLength(200, ErrorMessage = "Họ và tên không được vượt quá 200 ký tự.")]
        public string FullName { get; set; } = string.Empty;

        public byte Gender { get; set; }
        [MaxLength(300, ErrorMessage = "Địa chỉ không được vượt quá 300 ký tự.")]
        public string? Address { get; set; }

        public string RowVersion { get; set; } = string.Empty;

        // Có thể null nếu Patient chưa có User.
        public string? AccountRowVersion { get; set; }
    }
}
