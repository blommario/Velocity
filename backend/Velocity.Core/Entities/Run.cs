namespace Velocity.Core.Entities;

public class Run
{
    public Guid Id { get; set; }
    public Guid MapId { get; set; }
    public Guid PlayerId { get; set; }
    public float Time { get; set; }
    public float MaxSpeed { get; set; }
    public float AverageSpeed { get; set; }
    public int JumpCount { get; set; }
    public int RocketJumps { get; set; }
    public DateTime CompletedAt { get; set; }
    public bool HasReplay { get; set; }
    public byte[]? ReplayData { get; set; }
    public string? ReplayDataJson { get; set; }

    public GameMap Map { get; set; } = null!;
    public Player Player { get; set; } = null!;
}
