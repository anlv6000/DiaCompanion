using DiaCompanion.Services;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DiaCompanion.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MongoTestController : ControllerBase
    {
        private readonly MongoDbService _mongoDbService;

        public MongoTestController(MongoDbService mongoDbService)
        {
            _mongoDbService = mongoDbService;
        }

      
    }
}
