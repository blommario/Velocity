using System.Net.WebSockets;

namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Holds a player's WebSocket connection and metadata within a Room.
/// </summary>
/// <remarks>
/// Depends on: nothing (pure data + WebSocket reference)
/// Used by: Room
/// </remarks>
public sealed class PlayerSocket
{
    public required int Slot { get; init; }
    public required Guid PlayerId { get; init; }
    public required string PlayerName { get; init; }
    public required WebSocket Socket { get; init; }
    public long LastSeenAt { get; set; } = Environment.TickCount64;
    public bool IsActive { get; set; } = true;
    public bool IsFinished { get; set; }
    public float FinishTime { get; set; }
    public int Placement { get; set; }

    /// <summary>Last measured round-trip latency in milliseconds (from ping/pong).</summary>
    public double LatencyMs { get; set; }

    // ── Combat state ──

    /// <summary>Current health (0 = dead). Reset to MaxPlayerHealth on respawn/match start.</summary>
    public int Health { get; set; } = Configuration.WebSocketSettings.MaxPlayerHealth;

    /// <summary>Whether this player is currently dead and awaiting respawn.</summary>
    public bool IsDead { get; set; }

    /// <summary>Tick count of the last accepted hit event from this player (rate limiting).</summary>
    public long LastHitEventAt { get; set; }

    /// <summary>Total kills this match.</summary>
    public int Kills { get; set; }

    /// <summary>Total deaths this match.</summary>
    public int Deaths { get; set; }
}
