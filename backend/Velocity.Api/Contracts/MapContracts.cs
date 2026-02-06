using Velocity.Core.Entities;

namespace Velocity.Api.Contracts;

public record MapResponse(
    Guid Id,
    string Name,
    string Description,
    string AuthorName,
    MapDifficulty Difficulty,
    bool IsOfficial,
    int PlayCount,
    int LikeCount,
    float? WorldRecordTime,
    string MapDataJson,
    DateTime CreatedAt);

public record CreateMapRequest(
    string Name,
    string? Description,
    MapDifficulty Difficulty,
    string MapDataJson);
