namespace Velocity.Core.Entities;

public class Player
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsGuest { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastLoginAt { get; set; }

    public ICollection<GameMap> CreatedMaps { get; set; } = [];
    public ICollection<Run> Runs { get; set; } = [];
    public ICollection<LeaderboardEntry> LeaderboardEntries { get; set; } = [];
    public ICollection<MultiplayerRoom> HostedRooms { get; set; } = [];
    public ICollection<MultiplayerParticipant> MultiplayerParticipations { get; set; } = [];
}
