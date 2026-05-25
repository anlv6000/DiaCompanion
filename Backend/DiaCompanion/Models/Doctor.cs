using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DiaCompanion.Models
{
    public class Doctor
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = null!;

        [BsonElement("user_id")]
        [BsonRepresentation(BsonType.ObjectId)]
        public string UserId { get; set; } = null!;

        [BsonElement("specialty")]
        public string Specialty { get; set; } = null!;

        [BsonElement("license_number")]
        public string LicenseNumber { get; set; } = null!;

        [BsonElement("department")]
        public string Department { get; set; } = null!;

        [BsonElement("hospital")]
        public string Hospital { get; set; } = null!;
    }
}