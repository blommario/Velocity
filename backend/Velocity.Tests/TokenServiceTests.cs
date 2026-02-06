using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Velocity.Api.Configuration;
using Velocity.Api.Services;

namespace Velocity.Tests;

public class TokenServiceTests
{
    private readonly TokenService _sut;

    public TokenServiceTests()
    {
        var settings = new JwtSettings
        {
            Key = "TestKeyThatIsAtLeast32CharactersLong!!",
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            ExpirationInMinutes = 60,
        };

        _sut = new TokenService(Options.Create(settings));
    }

    [Fact]
    public void GenerateToken_ReturnsValidJwt()
    {
        var playerId = Guid.NewGuid();
        var username = "testuser";

        var token = _sut.GenerateToken(playerId, username);

        Assert.False(string.IsNullOrEmpty(token));

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        Assert.Equal("TestIssuer", jwt.Issuer);
        Assert.Contains(jwt.Audiences, a => a == "TestAudience");
    }

    [Fact]
    public void GenerateToken_ContainsCorrectClaims()
    {
        var playerId = Guid.NewGuid();
        var username = "speedrunner";

        var token = _sut.GenerateToken(playerId, username);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        var nameId = jwt.Claims.First(c => c.Type == ClaimTypes.NameIdentifier).Value;
        var name = jwt.Claims.First(c => c.Type == ClaimTypes.Name).Value;

        Assert.Equal(playerId.ToString(), nameId);
        Assert.Equal(username, name);
    }

    [Fact]
    public void GenerateToken_ExpiresInFuture()
    {
        var token = _sut.GenerateToken(Guid.NewGuid(), "user");
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.True(jwt.ValidTo > DateTime.UtcNow);
    }
}
