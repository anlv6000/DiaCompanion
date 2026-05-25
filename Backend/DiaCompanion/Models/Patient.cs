using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DiaCompanion.Models
{
    public class Patient
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = null!;

        [BsonElement("user_id")]
        public string UserId { get; set; } = null!;

        [BsonElement("full_name")]
        public string FullName { get; set; } = null!;

        [BsonElement("dob")]
        public string Dob { get; set; } = null!;

        [BsonElement("blood_type")]
        public string BloodType { get; set; } = null!;

        [BsonElement("diabetes_duration_years")]
        public int DiabetesDurationYears { get; set; }

        [BsonElement("diabetes_type")]
        public string DiabetesType { get; set; } = null!;

        [BsonElement("assigned_doctor_id")]
        public string AssignedDoctorId { get; set; } = null!;

        [BsonElement("gender")]
        public string Gender { get; set; } = null!;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; }
        [BsonElement("updatedAt")]
        public DateTime UpdateAt { get; set; }
    }
}
