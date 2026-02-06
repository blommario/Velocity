using Velocity.Api.Configuration;
using Velocity.Api.Contracts;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

public sealed class LeaderboardHandlers(ILeaderboardRepository leaderboard)
{
    public async ValueTask<IResult> GetByMap(Guid mapId, CancellationToken ct)
    {
        var entries = await leaderboard.GetByMapAsync(mapId, ValidationRules.LeaderboardMaxEntries, ct);

        var ranked = entries.Select((e, i) => new LeaderboardEntryResponse(
            i + 1,
            e.PlayerId,
            e.Player?.Username ?? ValidationRules.UnknownAuthorName,
            e.Time,
            e.MaxSpeed,
            e.AverageSpeed,
            e.JumpCount,
            e.AchievedAt));

        return Results.Ok(new LeaderboardResponse(mapId, ranked.ToList()));
    }
}
