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
}
