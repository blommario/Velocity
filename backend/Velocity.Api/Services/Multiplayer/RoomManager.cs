using System.Collections.Concurrent;
using System.Net.WebSockets;
using Microsoft.Extensions.Logging;
using Velocity.Api.Configuration;

namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Singleton service owning all active multiplayer rooms.
/// Rooms are created on first player join and removed when empty.
/// Rejects new joins during shutdown to prevent orphaned rooms.
/// Uses Lazy&lt;Room&gt; to ensure the factory runs exactly once per room ID,
/// preventing orphaned Room instances with running background tasks.
/// T1: adds stale room detection, force-close, and match-finished event relay.
/// </summary>
/// <remarks>
/// Depends on: Room
/// Used by: WebSocketEndpoints, MultiplayerHandlers, RoomCleanupService
/// </remarks>
public sealed class RoomManager : IAsyncDisposable
{
    private readonly ConcurrentDictionary<Guid, Lazy<Room>> _rooms = new();
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<RoomManager> _logger;
    private volatile bool _isShuttingDown;

    /// <summary>Relayed from Room.OnMatchFinished — includes roomId, results, and mapId.</summary>
    public event Action<Guid, IReadOnlyList<FinishResult>, Guid>? OnRoomMatchFinished;

    public RoomManager(ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
        _logger = loggerFactory.CreateLogger<RoomManager>();
    }

    /// <summary>
    /// Joins (or creates) a room and registers the player's WebSocket.
    /// Returns the room, assigned slot (or -1 if full or shutting down), and a Task that completes on disconnect.
    /// Uses Lazy&lt;Room&gt; so concurrent GetOrAdd calls never create duplicate Room instances.
    /// </summary>
    public (Room? room, int slot, Task disconnectTask) JoinRoom(Guid roomId, Guid playerId, string playerName, WebSocket socket)
    {
        if (_isShuttingDown)
            return (null, -1, Task.CompletedTask);

        var lazy = _rooms.GetOrAdd(roomId, id => new Lazy<Room>(() =>
        {
            var r = new Room(id, _loggerFactory.CreateLogger<Room>());
            r.OnEmpty += HandleRoomEmpty;
            r.OnMatchFinished += HandleMatchFinished;
            return r;
        }));

        var room = lazy.Value;

        // Guard: if the room was disposed between GetOrAdd and Value access
        // (e.g. last player left and OnEmpty fired concurrently), reject the join.
        if (room.IsDisposed)
        {
            _rooms.TryRemove(roomId, out _);
            return (room, -1, Task.CompletedTask);
        }

        var (slot, disconnectTask) = room.AddPlayer(playerId, playerName, socket);
        return (room, slot, disconnectTask);
    }

    /// <summary>
    /// Explicitly removes a player from a room by playerId.
    /// Returns the slot removed, or -1 if not found.
    /// </summary>
    public int LeaveRoom(Guid roomId, Guid playerId)
    {
        if (!_rooms.TryGetValue(roomId, out var lazy) || !lazy.IsValueCreated)
            return -1;

        var room = lazy.Value;
        var (slot, isEmpty) = room.RemovePlayerById(playerId);

        if (isEmpty)
        {
            RemoveRoom(roomId);
        }

        return slot;
    }

    /// <summary>
    /// Gets a room by ID, or null if it doesn't exist.
    /// </summary>
    public Room? GetRoom(Guid roomId)
    {
        return _rooms.TryGetValue(roomId, out var lazy) && lazy.IsValueCreated
            ? lazy.Value
            : null;
    }

    /// <summary>
    /// Returns a snapshot of all active room IDs and their player counts.
    /// </summary>
    public IReadOnlyList<(Guid RoomId, int PlayerCount)> GetAllRoomSnapshots()
    {
        return _rooms
            .Where(kv => kv.Value.IsValueCreated)
            .Select(kv => (kv.Key, kv.Value.Value.PlayerCount))
            .ToList();
    }

    /// <summary>
    /// Returns rooms that should be cleaned up based on age/status thresholds.
    /// </summary>
    public IReadOnlyList<(Guid RoomId, string Reason)> GetStaleRooms()
    {
        var stale = new List<(Guid, string)>();
        var now = Environment.TickCount64;

        foreach (var kv in _rooms)
        {
            if (!kv.Value.IsValueCreated) continue;
            var room = kv.Value.Value;
            if (room.IsDisposed) continue;

            var idleMs = now - room.LastActivityAt;

            switch (room.Status)
            {
                case RoomStatus.Waiting when idleMs > WebSocketSettings.WaitingRoomTimeoutMs:
                    stale.Add((kv.Key, $"Waiting room idle for {idleMs / 1000}s"));
                    break;

                case RoomStatus.Racing when idleMs > WebSocketSettings.MatchTimeoutMs:
                    stale.Add((kv.Key, $"Racing room exceeded timeout ({idleMs / 1000}s)"));
                    break;

                case RoomStatus.Finished when idleMs > WebSocketSettings.FinishedGracePeriodSeconds * 1000:
                    stale.Add((kv.Key, "Finished room grace period expired"));
                    break;
            }

            // Empty rooms with no players
            if (room.PlayerCount == 0)
            {
                stale.Add((kv.Key, "Empty room"));
            }
        }

        return stale;
    }

    /// <summary>
    /// Returns aggregate metrics across all rooms: total rooms, total players,
    /// total inbound messages, and average player latency.
    /// </summary>
    public (int ActiveRooms, int PlayersOnline, long TotalMessages, double AverageLatencyMs) GetAggregateMetrics()
    {
        int rooms = 0;
        int players = 0;
        long messages = 0;
        double latencySum = 0;
        int latencyRooms = 0;

        foreach (var kv in _rooms)
        {
            if (!kv.Value.IsValueCreated) continue;
            var room = kv.Value.Value;
            if (room.IsDisposed) continue;

            rooms++;
            players += room.PlayerCount;
            messages += room.InboundMessageCount;

            var avgLat = room.AveragePlayerLatencyMs;
            if (avgLat > 0)
            {
                latencySum += avgLat;
                latencyRooms++;
            }
        }

        var avgLatency = latencyRooms > 0 ? latencySum / latencyRooms : 0;
        return (rooms, players, messages, avgLatency);
    }

    /// <summary>Force-closes a room, disconnecting all players.</summary>
    public async Task ForceCloseRoom(Guid roomId)
    {
        if (_rooms.TryRemove(roomId, out var lazy) && lazy.IsValueCreated)
        {
            var room = lazy.Value;
            try
            {
                await room.BroadcastJsonAsync("room_closed", new { reason = "Room timed out" });
            }
            catch
            {
                // Best effort
            }

            await room.DisposeAsync();
        }
    }

    private void HandleRoomEmpty(Guid roomId)
    {
        RemoveRoom(roomId);
    }

    private void HandleMatchFinished(Guid roomId, IReadOnlyList<FinishResult> results)
    {
        var room = GetRoom(roomId);
        var mapId = room?.MapId ?? Guid.Empty;
        OnRoomMatchFinished?.Invoke(roomId, results, mapId);
    }

    private void RemoveRoom(Guid roomId)
    {
        if (_rooms.TryRemove(roomId, out var lazy) && lazy.IsValueCreated)
        {
            _ = lazy.Value.DisposeAsync();
        }
    }

    public async ValueTask DisposeAsync()
    {
        _isShuttingDown = true;

        var roomIds = _rooms.Keys.ToList();
        var disposeTasks = new List<ValueTask>();

        foreach (var id in roomIds)
        {
            if (_rooms.TryRemove(id, out var lazy) && lazy.IsValueCreated)
            {
                disposeTasks.Add(lazy.Value.DisposeAsync());
            }
        }

        foreach (var task in disposeTasks)
        {
            await task;
        }
    }
}
