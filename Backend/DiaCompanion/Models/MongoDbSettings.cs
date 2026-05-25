namespace DiaCompanion.Models
{
    public class MongoDbSettings
    {
        public string MongoURI { get; set; } = null!;
        public string DatabaseName { get; set; } = null!;
        public string UserCollectionName { get; set; } = "User";
    }
}
