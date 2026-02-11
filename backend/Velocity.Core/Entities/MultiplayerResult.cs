namespace Velocity.Core.Entities;

/// <summary>
/// Persisted result of a player in a completed race — enables leaderboard history and stats.
/// </summary>
/// <remarks>
/// Depends on: RaceRoom, Player
/// Used by: RaceHandlers (finish recording), Leaderboard queries
/// </remarks>
public class RaceResult
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public Guid MapId { get; set; }
    public Guid PlayerId { get; set; }
    public float? FinishTime { get; set; }
    public int Placement { get; set; }
    public string GameMode { get; set; } = "Race";
    public DateTime CreatedAt { get; set; }

    public RaceRoom Room { get; set; } = null!;
    public GameMap Map { get; set; } = null!;
    public Player Player { get; set; } = null!;
}
