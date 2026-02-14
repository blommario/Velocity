using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;
using Velocity.Api.Configuration;
using Velocity.Api.Services;
using Velocity.Api.Services.Multiplayer;

namespace Velocity.Api.Endpoints;

/// <summary>
/// WebTransport upgrade endpoint for real-time multiplayer rooms.
/// Uses QUIC bidirectional streams for binary position data and JSON control messages.
/// Client opens two bidirectional streams after session is accepted.
/// Each stream is identified by a single type byte written by the client:
/// 0x01 = position data, 0x02 = control (JSON/MessagePack).
/// </summary>
/// <remarks>
/// Depends on: RoomManager, JwtSettings, TokenValidation, TransportSettings
/// Used by: Program.cs (endpoint mapping)
/// </remarks>
public static class WebTransportEndpoints
{
    public static WebApplication MapWebTransportEndpoints(this WebApplication app)
    {
        app.Map($"{TransportSettings.WebTransportPath}/{{roomId:guid}}", async (
            HttpContext context,
            Guid roomId,
            RoomManager roomManager,
            IOptions<JwtSettings> jwtOptions) =>
        {
            var feature = context.Features.Get<IHttpWebTransportFeature>();
            if (feature is null || !feature.IsWebTransportRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("WebTransport connections only.");
                return;
            }

            // JWT validation from query parameter (transport upgrades can't use custom headers)
            var token = context.Request.Query["token"].FirstOrDefault();
            if (string.IsNullOrEmpty(token))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync(ValidationMessages.InvalidCredentials);
                return;
            }

            var principal = TokenValidation.ValidateToken(token, jwtOptions.Value);
            if (principal is null)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync(ValidationMessages.InvalidCredentials);
                return;
            }

            var playerInfo = TokenValidation.ExtractPlayerInfo(principal);
            if (playerInfo is null)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync(ValidationMessages.InvalidCredentials);
                return;
            }

            var (playerId, playerName) = playerInfo.Value;

            // Accept WebTransport session
            var session = await feature.AcceptAsync(CancellationToken.None);

            // Accept two bidirectional streams opened by the client.
            // Each stream writes a single type byte as its first byte:
            //   0x01 = position stream (binary position data)
            //   0x02 = control stream (JSON/MessagePack control messages)
            // This avoids relying on stream accept order which is non-deterministic in QUIC.
            ConnectionContext? positionCtx = null;
            ConnectionContext? controlCtx = null;

            try
            {
                for (var i = 0; i < 2; i++)
                {
                    var stream = await session.AcceptStreamAsync(CancellationToken.None);
                    if (stream is null) break;

                    var readResult = await stream.Transport.Input.ReadAsync(CancellationToken.None);
                    if (readResult.Buffer.IsEmpty)
                    {
                        stream.Abort();
                        await stream.DisposeAsync();
                        continue;
                    }

                    var typeByte = readResult.Buffer.FirstSpan[0];
                    stream.Transport.Input.AdvanceTo(readResult.Buffer.GetPosition(1));

                    if (typeByte == TransportSettings.StreamTypePosition)
                        positionCtx = stream;
                    else if (typeByte == TransportSettings.StreamTypeControl)
                        controlCtx = stream;
                    else
                    {
                        stream.Abort();
                        await stream.DisposeAsync();
                    }
                }
            }
            catch
            {
                if (positionCtx is not null) { positionCtx.Abort(); await positionCtx.DisposeAsync(); }
                if (controlCtx is not null) { controlCtx.Abort(); await controlCtx.DisposeAsync(); }
                session.Abort(TransportSettings.AbortProtocolError);
                return;
            }

            if (positionCtx is null || controlCtx is null)
            {
                if (positionCtx is not null) { positionCtx.Abort(); await positionCtx.DisposeAsync(); }
                if (controlCtx is not null) { controlCtx.Abort(); await controlCtx.DisposeAsync(); }
                session.Abort(TransportSettings.AbortProtocolError);
                return;
            }

            var connection = new WebTransportPlayerConnection(
                positionCtx,
                controlCtx,
                () => session.Abort(TransportSettings.AbortProtocolError));

            var (room, slot, disconnectTask) = roomManager.JoinRoom(roomId, playerId, playerName, connection);

            if (room is null || slot < 0)
            {
                await connection.CloseAsync(
                    room is null ? "Server is shutting down." : ValidationMessages.RoomFull,
                    CancellationToken.None);
                await connection.DisposeAsync();
                return;
            }

            // Notify other players
            await room.BroadcastJsonAsync("player_joined", new
            {
                playerId,
                playerName,
                slot,
            });

            // Send current room state to the new player only
            var snapshot = room.GetPlayerSnapshot();
            await room.SendJsonToPlayerAsync(slot, "room_snapshot", new
            {
                roomId,
                players = snapshot.Select(p => new { playerId = p.PlayerId, name = p.Name, slot = p.Slot }),
                yourSlot = slot,
            });

            // Keep the middleware alive until the player disconnects.
            // Room.ReceiveLoop signals disconnectTask when the connection closes.
            try
            {
                await Task.WhenAny(disconnectTask, Task.Delay(Timeout.Infinite, context.RequestAborted));
            }
            catch (OperationCanceledException)
            {
                // Request aborted — Room's ReceiveLoop will handle connection cleanup
            }
        });

        return app;
    }
}
