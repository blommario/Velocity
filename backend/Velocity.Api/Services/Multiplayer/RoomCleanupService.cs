namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Hosted service that gracefully shuts down all WebSocket rooms when the application stops.
/// Also handles periodic cleanup of stale rooms (future: T1 room lifecycle).
/// </summary>
/// <remarks>
/// Depends on: RoomManager
/// Used by: Program.cs (DI registration)
/// </remarks>
public sealed class RoomCleanupService(RoomManager roomManager) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        // No-op on start — rooms are created on demand
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        // Gracefully dispose all rooms (sends close frames to all players)
        await roomManager.DisposeAsync();
    }
}
