namespace Velocity.Core.Entities;

public class RaceRoom
{
    public Guid Id { get; set; }
    public Guid MapId { get; set; }
    public Guid HostPlayerId { get; set; }
    public string Status { get; set; } = RaceRoomStatus.Waiting;
    public int MaxPlayers { get; set; } = 8;
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }

    public GameMap Map { get; set; } = null!;
    public Player Host { get; set; } = null!;
    public ICollection<RaceParticipant> Participants { get; set; } = [];
}

public static class RaceRoomStatus
{
    public const string Waiting = "waiting";
    public const string Countdown = "countdown";
    public const string Racing = "racing";
    public const string Finished = "finished";
}
