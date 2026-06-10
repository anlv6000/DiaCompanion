using DiaCompanion.DTOs;
using DiaCompanion.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace DiaCompanion.Services
{
    public class AuthService
    {
        private readonly IMongoCollection<User> _userCollection;
        private readonly IMongoCollection<Doctor> _doctorCollection;

        private readonly JwtSettings _jwtSettings;
        private readonly IMongoCollection<Patient> _patientCollection;

        public AuthService(
           MongoDbService mongoDbService,
           IOptions<JwtSettings> jwtSettings)
        {
            _userCollection =
                mongoDbService.GetCollection<User>("User");
            _doctorCollection =
    mongoDbService.GetCollection<Doctor>("Doctor");
            _jwtSettings = jwtSettings.Value;
        }

        public async Task RegisterAsync(RegisterDto dto)
        {
            var existingUser =
                await _userCollection
                    .Find(x => x.Email == dto.Email)
                    .FirstOrDefaultAsync();

            if (existingUser != null)
            {
                throw new Exception("Email already exists");
            }

            var user = new User
            {
                FullName = dto.FullName,
                PhoneNumber = dto.PhoneNumber,
                Email = dto.Email,

                PasswordHash =
                    BCrypt.Net.BCrypt.HashPassword(
                        dto.Password),

                Gender = dto.Gender,

                Dob = dto.Dob,

                Role = UserRole.Patient,

                CreatedAt = DateTime.UtcNow
            };

            await _userCollection.InsertOneAsync(user);
        }


        public async Task RegisterDotorAsync(RegisterDoctorDto dto)
        {
            var existingUser =
                await _userCollection
                    .Find(x => x.Email == dto.Email)
                    .FirstOrDefaultAsync();

            if (existingUser != null)
            {
                throw new Exception("Email already exists");
            }

            var user = new User
            {
                FullName = dto.FullName,
                PhoneNumber = dto.PhoneNumber,
                Email = dto.Email,

                PasswordHash =
                    BCrypt.Net.BCrypt.HashPassword(
                        dto.Password),

                Gender = dto.Gender,

                Dob = dto.Dob,

                Role = UserRole.Doctor,

                CreatedAt = DateTime.UtcNow

            };

            await _userCollection.InsertOneAsync(user);


            var doctor = new Doctor
            {
                UserId = user.Id,

                Specialty = dto.Specialty,

                LicenseNumber = dto.LicenseNumber,

                Department = dto.Department,

                Hospital = dto.Hospital
            };


            await _doctorCollection.InsertOneAsync(doctor);

        }


        // LOGIN
        public async Task<string> LoginAsync(
            LoginDto dto)
        {
            var user =
                await _userCollection
                    .Find(x => x.Email == dto.Email)
                    .FirstOrDefaultAsync();

            if (user == null)
            {
                throw new Exception("Invalid email");
            }

            bool isPasswordValid =
                BCrypt.Net.BCrypt.Verify(
                    dto.Password,
                    user.PasswordHash);

            if (!isPasswordValid)
            {
                throw new Exception("Invalid password");
            }

            return GenerateJwtToken(user);
        }
        // GENERATE JWT
        private string GenerateJwtToken(User user)
        {
            var claims = new[]
            {
                new Claim(
                    JwtRegisteredClaimNames.Sub,
                    user.Id),

                new Claim(
                    JwtRegisteredClaimNames.Email,
                    user.Email),

                new Claim(
                    ClaimTypes.Role, user.Role.ToString()),
                new Claim(
                    "full_name",
                    user.FullName)
            };
            var key =
                new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(
                        _jwtSettings.SecretKey));
            var credentials =
                new SigningCredentials(
                    key,
                    SecurityAlgorithms.HmacSha256);
            var token =
                new JwtSecurityToken(
                    issuer: _jwtSettings.Issuer,
                    audience: _jwtSettings.Audience,
                    claims: claims,
                    expires:
                        DateTime.UtcNow.AddMinutes(
                            _jwtSettings.ExpiryMinutes),
                    signingCredentials: credentials);
            return new JwtSecurityTokenHandler()
                .WriteToken(token);
        }
    }
}
