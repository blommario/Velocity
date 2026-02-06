using Velocity.Api.DTOs;
using Velocity.Api.Services;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

public class AuthHandlers(IPlayerRepository players, TokenService tokenService)
{
    public async ValueTask<IResult> Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Length < 3)
            return Results.BadRequest("Username must be at least 3 characters.");

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            return Results.BadRequest("Password must be at least 6 characters.");

        var existing = await players.GetByUsernameAsync(request.Username);
        if (existing is not null)
            return Results.Conflict("Username already taken.");

        var player = new Player
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsGuest = false,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
        };

        await players.CreateAsync(player);
        var token = tokenService.GenerateToken(player.Id, player.Username);
        return Results.Ok(new AuthResponse(token, player.Id, player.Username));
    }

    public async ValueTask<IResult> Login(LoginRequest request)
    {
        var player = await players.GetByUsernameAsync(request.Username);
        if (player is null || !BCrypt.Net.BCrypt.Verify(request.Password, player.PasswordHash))
            return Results.Json(new { error = "Invalid username or password." }, statusCode: 401);

        player.LastLoginAt = DateTime.UtcNow;
        await players.UpdateAsync(player);

        var token = tokenService.GenerateToken(player.Id, player.Username);
        return Results.Ok(new AuthResponse(token, player.Id, player.Username));
    }

    public async ValueTask<IResult> Guest()
    {
        var guestName = $"Guest_{Guid.NewGuid().ToString()[..8]}";
        var player = new Player
        {
            Id = Guid.NewGuid(),
            Username = guestName,
            PasswordHash = string.Empty,
            IsGuest = true,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
        };

        await players.CreateAsync(player);
        var token = tokenService.GenerateToken(player.Id, player.Username);
        return Results.Ok(new AuthResponse(token, player.Id, player.Username));
    }
}
