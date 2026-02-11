using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Velocity.Api.Configuration;
using Velocity.Api.Services.Multiplayer;

namespace Velocity.Api.Endpoints;

/// <summary>
/// WebSocket upgrade endpoint for real-time multiplayer rooms.
/// Replaces SSE for position streaming — uses binary protocol at 20Hz.
/// </summary>
/// <remarks>
/// Depends on: RoomManager, JwtSettings
/// Used by: Program.cs (endpoint mapping)
/// </remarks>
public static class WebSocketEndpoints
{
    public static WebApplication MapWebSocketEndpoints(this WebApplication app)
    {
        app.Map("/ws/multiplayer/{roomId:guid}", async (
            HttpContext context,
            Guid roomId,
            RoomManager roomManager,
            IOptions<JwtSettings> jwtOptions) =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("WebSocket connections only.");
                return;
            }

            // JWT validation from query parameter (WebSocket doesn't support custom headers on upgrade)
            var token = context.Request.Query["token"].FirstOrDefault();
            if (string.IsNullOrEmpty(token))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync(ValidationMessages.InvalidCredentials);
                return;
            }

            var principal = ValidateToken(token, jwtOptions.Value);
            if (principal is null)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync(ValidationMessages.InvalidCredentials);
                return;
            }

            var playerIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (playerIdClaim is null || !Guid.TryParse(playerIdClaim, out var playerId))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync(ValidationMessages.InvalidCredentials);
                return;
            }

            var playerName = principal.FindFirstValue(ClaimTypes.Name) ?? ValidationRules.UnknownAuthorName;

            // Accept WebSocket
            using var socket = await context.WebSockets.AcceptWebSocketAsync();

            var (room, slot, disconnectTask) = roomManager.JoinRoom(roomId, playerId, playerName, socket);

            if (room is null || slot < 0)
            {
                await socket.CloseAsync(
                    System.Net.WebSockets.WebSocketCloseStatus.PolicyViolation,
                    room is null ? "Server is shutting down." : ValidationMessages.RoomFull,
                    CancellationToken.None);
                return;
            }

            // Notify other players
            await room.BroadcastJsonAsync("player_joined", new
            {
                playerId,
                playerName,
                slot,
            });

            // Send current room state to the new player
            var snapshot = room.GetPlayerSnapshot();
            await room.BroadcastJsonAsync("room_snapshot", new
            {
                roomId,
                players = snapshot.Select(p => new { p.PlayerId, p.Name, p.Slot }),
                yourSlot = slot,
            });

            // Keep the middleware alive until the player disconnects.
            // Room.ReceiveLoop signals disconnectTask when the socket closes.
            // Also respect request abort (server shutdown / client disconnect at HTTP level).
            try
            {
                await Task.WhenAny(disconnectTask, Task.Delay(Timeout.Infinite, context.RequestAborted));
            }
            catch (OperationCanceledException)
            {
                // Request aborted — Room's ReceiveLoop will handle socket cleanup
            }
        });

        return app;
    }

    private static readonly JwtSecurityTokenHandler TokenHandler = new();

    private static ClaimsPrincipal? ValidateToken(string token, JwtSettings settings)
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
}
