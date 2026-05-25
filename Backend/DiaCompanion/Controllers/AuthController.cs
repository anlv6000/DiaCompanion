using DiaCompanion.DTOs;
using DiaCompanion.Services;
using Microsoft.AspNetCore.Mvc;

namespace DiaCompanion.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : Controller
    {
        private readonly AuthService _authService;

        public AuthController(
            AuthService authService)
        {
            _authService = authService;
        }
        [HttpPost("register")]
        public async Task<IActionResult> Register(
            RegisterDto dto)
        {
            await _authService.RegisterAsync(dto);

            return Ok(new
            {
                message = "Register success"
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(
            LoginDto dto)
        {
            var token =
                await _authService.LoginAsync(dto);
            return Ok(new
            {
                token
            });
        }
    }
}
