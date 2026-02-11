namespace Velocity.Core.Entities;

public class MultiplayerParticipant
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public Guid PlayerId { get; set; }
    public bool IsReady { get; set; }
    public float? FinishTime { get; set; }
    public DateTime JoinedAt { get; set; }

    public MultiplayerRoom Room { get; set; } = null!;
    public Player Player { get; set; } = null!;
}
