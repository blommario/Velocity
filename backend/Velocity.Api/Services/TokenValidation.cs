using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Velocity.Api.Configuration;

namespace Velocity.Api.Services;

/// <summary>
/// Shared JWT token validation for transport endpoints (WebTransport).
/// Tokens are passed as query parameters since transport upgrades cannot use custom headers.
/// </summary>
/// <remarks>
/// Depends on: JwtSettings
/// Used by: WebTransportEndpoints
/// </remarks>
public static class TokenValidation
{
    private static readonly JwtSecurityTokenHandler TokenHandler = new();

    /// <summary>
    /// Validates a JWT token and returns the ClaimsPrincipal, or null if invalid.
    /// </summary>
    public static ClaimsPrincipal? ValidateToken(string token, JwtSettings settings)
    {
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = settings.Issuer,
            ValidAudience = settings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(settings.Key)),
        };

        try
        {
            return TokenHandler.ValidateToken(token, parameters, out _);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Extracts player ID and name from a validated ClaimsPrincipal.
    /// Returns null if the required claims are missing.
    /// </summary>
    public static (Guid playerId, string playerName)? ExtractPlayerInfo(ClaimsPrincipal principal)
    {
        var playerIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (playerIdClaim is null || !Guid.TryParse(playerIdClaim, out var playerId))
            return null;

        var playerName = principal.FindFirstValue(ClaimTypes.Name) ?? ValidationRules.UnknownAuthorName;
        return (playerId, playerName);
    }
}
