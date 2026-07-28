using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

public interface IJwtTokenService
{
    string Create(User user, int? patientId, out DateTime expiresAt);
    SymmetricSecurityKey SigningKey { get; }
}

public class JwtTokenService : IJwtTokenService
{
    private readonly IConfiguration _cfg;
    public SymmetricSecurityKey SigningKey { get; }

    public JwtTokenService(IConfiguration cfg)
    {
        _cfg = cfg;
        // QT-19: khoá ký lấy từ biến môi trường / user-secrets, KHÔNG từ bảng SystemConfigs.
        var key = cfg["Jwt:SigningKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development")
                key = "dev-only-signing-key-do-not-use-in-production-0123456789";
            else
                throw new InvalidOperationException(
                    "Thiếu Jwt:SigningKey. Đặt biến môi trường JWT__SIGNINGKEY trước khi chạy.");
        }
        SigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }

    public string Create(User user, int? patientId, out DateTime expiresAt)
    {
        var minutes = int.TryParse(_cfg["Jwt:ExpiryMinutes"], out var m) ? m : 480;
        expiresAt = DateTime.UtcNow.AddMinutes(minutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("fullName", user.FullName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        if (patientId is int pid) claims.Add(new Claim("patientId", pid.ToString()));
        if (user.MustChangePassword) claims.Add(new Claim("mustChangePassword", "true"));

        var token = new JwtSecurityToken(
            issuer: _cfg["Jwt:Issuer"],
            audience: _cfg["Jwt:Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
