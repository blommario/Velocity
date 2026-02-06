namespace Velocity.Core.Entities;

public class LeaderboardEntry
{
    public Guid Id { get; set; }
    public Guid MapId { get; set; }
    public Guid PlayerId { get; set; }
    public float Time { get; set; }
    public float MaxSpeed { get; set; }
    public float AverageSpeed { get; set; }
    public int JumpCount { get; set; }
    public int RocketJumps { get; set; }
    public DateTime AchievedAt { get; set; }
    public bool HasReplay { get; set; }
    public Guid? RunId { get; set; }

    public GameMap Map { get; set; } = null!;
    public Player Player { get; set; } = null!;
    public Run? Run { get; set; }
}
