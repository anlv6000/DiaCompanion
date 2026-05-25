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

        [HttpGet("ping")]
        public async Task<IActionResult> Ping()
        {
            try
            {
                var database = _mongoDbService.Database;

                // Ping MongoDB
                await database.RunCommandAsync((Command<BsonDocument>)"{ping:1}");

                return Ok(new
                {
                    success = true,
                    message = "MongoDB connected successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }
    }
}
