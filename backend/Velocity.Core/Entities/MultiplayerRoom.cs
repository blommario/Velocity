namespace Velocity.Core.Entities;

public class MultiplayerRoom
{
    public Guid Id { get; set; }
    public Guid MapId { get; set; }
    public Guid HostPlayerId { get; set; }
    public string Status { get; set; } = MultiplayerRoomStatus.Waiting;
    public int MaxPlayers { get; set; } = 8;
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }

    public GameMap Map { get; set; } = null!;
    public Player Host { get; set; } = null!;
    public ICollection<MultiplayerParticipant> Participants { get; set; } = [];
}

public static class MultiplayerRoomStatus
{
    public const string Waiting = "waiting";
    public const string Countdown = "countdown";
    public const string InGame = "ingame";
    public const string Finished = "finished";
}
