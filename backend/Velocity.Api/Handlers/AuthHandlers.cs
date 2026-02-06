using Velocity.Api.Configuration;
using Velocity.Api.Contracts;
using Velocity.Api.Services;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

public sealed class AuthHandlers(IPlayerRepository players, TokenService tokenService)
{
    public async ValueTask<IResult> Register(RegisterRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username)
            || request.Username.Length < ValidationRules.UsernameMinLength)
            return Results.BadRequest(ValidationMessages.UsernameMinLength);

        if (request.Username.Length > ValidationRules.UsernameMaxLength)
            return Results.BadRequest(ValidationMessages.UsernameMaxLength);

        if (string.IsNullOrWhiteSpace(request.Password)
            || request.Password.Length < ValidationRules.PasswordMinLength)
            return Results.BadRequest(ValidationMessages.PasswordMinLength);

        var existing = await players.GetByUsernameAsync(request.Username, ct);
        if (existing is not null)
            return Results.Conflict(ValidationMessages.UsernameTaken);

        var player = new Player
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsGuest = false,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
        };

        await players.CreateAsync(player, ct);
        var token = tokenService.GenerateToken(player.Id, player.Username);
        return Results.Ok(new AuthResponse(token, player.Id, player.Username));
    }

    public async ValueTask<IResult> Login(LoginRequest request, CancellationToken ct)
    {
        var player = await players.GetByUsernameAsync(request.Username, ct);
        if (player is null || !BCrypt.Net.BCrypt.Verify(request.Password, player.PasswordHash))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        player.LastLoginAt = DateTime.UtcNow;
        await players.UpdateAsync(player, ct);

        var token = tokenService.GenerateToken(player.Id, player.Username);
        return Results.Ok(new AuthResponse(token, player.Id, player.Username));
    }

    public async ValueTask<IResult> Guest(CancellationToken ct)
    {
        var guestName = $"{ValidationRules.GuestNamePrefix}_{Guid.NewGuid().ToString("N")[..ValidationRules.GuestNameSuffixLength]}";
        var player = new Player
        {
            Id = Guid.NewGuid(),
            Username = guestName,
            PasswordHash = string.Empty,
            IsGuest = true,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
        };

        await players.CreateAsync(player, ct);
        var token = tokenService.GenerateToken(player.Id, player.Username);
        return Results.Ok(new AuthResponse(token, player.Id, player.Username));
    }
}
