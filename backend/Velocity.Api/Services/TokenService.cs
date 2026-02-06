using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Velocity.Api.Configuration;

namespace Velocity.Api.Services;

public sealed class TokenService(IOptions<JwtSettings> options)
{
    private readonly JwtSettings _settings = options.Value;

    public string GenerateToken(Guid playerId, string username)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_settings.Key));

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, playerId.ToString()),
            new Claim(ClaimTypes.Name, username),
        };

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_settings.ExpirationInMinutes),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
