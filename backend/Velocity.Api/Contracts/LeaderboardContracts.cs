namespace Velocity.Api.Contracts;

public record LeaderboardEntryResponse(
    int Rank,
    Guid PlayerId,
    string PlayerName,
    float Time,
    float MaxSpeed,
    float AverageSpeed,
    int JumpCount,
    DateTime AchievedAt);

public record LeaderboardResponse(
    Guid MapId,
    IReadOnlyList<LeaderboardEntryResponse> Entries);
