using DiaCompanion.Models;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace DiaCompanion.Services
{
    public class PatientService
    {
        private readonly IMongoCollection<Patient> _patientCollection;

        public PatientService(MongoDbService mongoDbService)
        {
            _patientCollection = mongoDbService.GetCollection<Patient>("Patient");
        }

        public async Task<List<Patient>> GetAllAsync()
        {
            return await _patientCollection
                .AsQueryable()
                .ToListAsync();
        }
    }
}
