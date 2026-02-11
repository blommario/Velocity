namespace Velocity.Api.Configuration;

/// <summary>
/// Centralized constants for WebSocket multiplayer transport.
/// </summary>
/// <remarks>
/// Used by: Room, RoomManager, WebSocketEndpoints, RoomCleanupService
/// </remarks>
public static class WebSocketSettings
{
    /// <summary>Server broadcast tick rate in milliseconds (20Hz = 50ms).</summary>
    public const int BroadcastIntervalMs = 50;

    /// <summary>Heartbeat ping interval in milliseconds.</summary>
    public const int HeartbeatIntervalMs = 5000;

    /// <summary>Kick player after this many milliseconds without a message.</summary>
    public const int HeartbeatTimeoutMs = 15000;

    /// <summary>Maximum players per room (hard cap).</summary>
    public const int MaxPlayersPerRoom = 32;

    /// <summary>Inbound message channel capacity per room.</summary>
    public const int InboundChannelCapacity = 256;

    /// <summary>Maximum inbound messages per second per player (position rate limit).</summary>
    public const int MaxPositionMessagesPerSecond = 25;

    /// <summary>WebSocket receive buffer size in bytes.</summary>
    public const int ReceiveBufferSize = 1024;

    /// <summary>Binary message type prefix: position update from client.</summary>
    public const byte MsgTypePosition = 0x01;

    /// <summary>Binary message type prefix: position batch from server.</summary>
    public const byte MsgTypePositionBatch = 0x02;

    /// <summary>JSON message type prefix.</summary>
    public const byte MsgTypeJson = 0x80;

    // ── Match lifecycle ──

    /// <summary>Countdown duration in seconds (3→2→1→GO).</summary>
    public const int CountdownSeconds = 3;

    /// <summary>Max match duration before force-finish (5 minutes).</summary>
    public const int MatchTimeoutMs = 300_000;

    /// <summary>Delay after all players finish before room auto-closes (seconds).</summary>
    public const int FinishedGracePeriodSeconds = 120;

    /// <summary>Max idle time for a waiting room before cleanup (30 minutes).</summary>
    public const int WaitingRoomTimeoutMs = 1_800_000;

    /// <summary>Cleanup service scan interval (60 seconds).</summary>
    public const int CleanupIntervalMs = 60_000;

    // ── Combat ──

    /// <summary>Starting and max health for each player.</summary>
    public const int MaxPlayerHealth = 100;

    /// <summary>Delay in milliseconds before a killed player respawns.</summary>
    public const int RespawnDelayMs = 3000;

    /// <summary>Maximum valid hit distance (units). Hits beyond this are rejected.</summary>
    public const float MaxHitDistance = 600f;

    /// <summary>Minimum milliseconds between accepted hit events from one player (rate limit).</summary>
    public const int MinFireIntervalMs = 50;

    /// <summary>Maximum damage a single hit event can deal (server-side cap).</summary>
    public const int MaxDamagePerHit = 500;
}
