using Velocity.Api.Handlers;

namespace Velocity.Api.Endpoints;

public static class LeaderboardEndpoints
{
    public static RouteGroupBuilder MapLeaderboardEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/maps")
            .WithTags("Leaderboard");

        group.MapGet("/{mapId:guid}/leaderboard", (Guid mapId, LeaderboardHandlers handler, CancellationToken ct)
            => handler.GetByMap(mapId, ct));

        return group;
    }
}
