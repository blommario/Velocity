namespace Velocity.Api.Contracts;

public record SubmitRunRequest(
    Guid MapId,
    float Time,
    float MaxSpeed,
    float AverageSpeed,
    int JumpCount,
    int RocketJumps);

public record RunResponse(
    Guid Id,
    Guid MapId,
    Guid PlayerId,
    string PlayerName,
    float Time,
    float MaxSpeed,
    float AverageSpeed,
    int JumpCount,
    int RocketJumps,
    DateTime CompletedAt,
    bool IsPersonalBest);
