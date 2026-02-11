namespace Velocity.Core.Entities;

/// <summary>
/// Persisted result of a player in a completed multiplayer match — enables leaderboard history and stats.
/// </summary>
/// <remarks>
/// Depends on: MultiplayerRoom, Player
/// Used by: MultiplayerHandlers (finish recording), Leaderboard queries
/// </remarks>
public class MultiplayerResult
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public Guid MapId { get; set; }
    public Guid PlayerId { get; set; }
    public float? FinishTime { get; set; }
    public int Placement { get; set; }
    public string GameMode { get; set; } = "Multiplayer";
    public DateTime CreatedAt { get; set; }

    public MultiplayerRoom Room { get; set; } = null!;
    public GameMap Map { get; set; } = null!;
    public Player Player { get; set; } = null!;
}
