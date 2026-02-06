namespace Velocity.Api.Contracts;

public record PlayerProfileResponse(
    Guid Id,
    string Username,
    bool IsGuest,
    DateTime CreatedAt,
    int TotalRuns,
    int MapsCreated,
    int LeaderboardEntries);
