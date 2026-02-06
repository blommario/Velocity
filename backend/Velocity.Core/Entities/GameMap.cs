namespace Velocity.Core.Entities;

public class GameMap
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid AuthorId { get; set; }
    public MapDifficulty Difficulty { get; set; }
    public bool IsOfficial { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int PlayCount { get; set; }
    public int LikeCount { get; set; }
    public float? WorldRecordTime { get; set; }

    /// <summary>
    /// Map geometry and objects stored as JSON (deserialized on the frontend).
    /// </summary>
    public string MapDataJson { get; set; } = "{}";

    public Player Author { get; set; } = null!;
    public ICollection<LeaderboardEntry> LeaderboardEntries { get; set; } = [];
    public ICollection<Run> Runs { get; set; } = [];
}
