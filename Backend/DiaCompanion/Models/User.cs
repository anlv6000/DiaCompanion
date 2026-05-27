using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DiaCompanion.Models
{
    public enum UserRole
    {
        Patient,
        Doctor,
        Admin
    }
    public class User
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = null!;

        [BsonElement("full_name")]
        public string FullName { get; set; } = null!;

        [BsonElement("email")]
        public string Email { get; set; } = null!;

        [BsonElement("phone_number")]
        public string PhoneNumber { get; set; } = null!;

        [BsonElement("password_hash")]
        public string PasswordHash { get; set; } = null!;

        [BsonElement("role")]
        [BsonRepresentation(BsonType.String)]
        public UserRole Role { get; set; }

        [BsonElement("gender")]
        public string Gender { get; set; } = null!;

        [BsonElement("dob")]
        public DateTime Dob { get; set; }

        [BsonElement("created_at")]
        public DateTime CreatedAt { get; set; }

        [BsonElement("updated_at")]
        public DateTime UpdatedAt { get; set; }
    }
}
