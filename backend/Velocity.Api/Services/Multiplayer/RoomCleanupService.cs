using Velocity.Api.Configuration;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Background service that (1) periodically cleans up stale rooms and
/// (2) gracefully shuts down all WebSocket rooms when the application stops.
/// Also persists multiplayer results to DB when rooms finish via RoomManager event.
/// </summary>
/// <remarks>
/// Depends on: RoomManager, IServiceScopeFactory
/// Used by: Program.cs (DI registration)
/// </remarks>
public sealed class RoomCleanupService(
    RoomManager roomManager,
    IServiceScopeFactory scopeFactory,
    ILogger<RoomCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        roomManager.OnRoomMatchFinished += HandleMatchFinished;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(WebSocketSettings.CleanupIntervalMs, stoppingToken);
                await CleanupStaleRooms();
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during room cleanup scan");
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        roomManager.OnRoomMatchFinished -= HandleMatchFinished;
        await roomManager.DisposeAsync();
        await base.StopAsync(cancellationToken);
    }

    private async Task CleanupStaleRooms()
    {
        var staleRooms = roomManager.GetStaleRooms();
        foreach (var (roomId, reason) in staleRooms)
        {
            logger.LogInformation("Cleaning up room {RoomId}: {Reason}", roomId, reason);
            await roomManager.ForceCloseRoom(roomId);
        }
    }

    private void HandleMatchFinished(Guid roomId, IReadOnlyList<FinishResult> results, Guid mapId)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IMultiplayerRoomRepository>();

                foreach (var result in results)
                {
                    var multiplayerResult = new MultiplayerResult
                    {
                        Id = Guid.NewGuid(),
                        RoomId = roomId,
                        MapId = mapId,
                        PlayerId = result.PlayerId,
                        FinishTime = result.FinishTime,
                        Placement = result.Placement,
                        GameMode = "Multiplayer",
                        CreatedAt = DateTime.UtcNow,
                    };

                    await repo.SaveResultAsync(multiplayerResult);
                }

                logger.LogInformation("Persisted {Count} multiplayer results for room {RoomId}", results.Count, roomId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to persist multiplayer results for room {RoomId}", roomId);
            }
        });
    }
}
