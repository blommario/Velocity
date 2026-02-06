using Microsoft.EntityFrameworkCore;
using Velocity.Api.Configuration;
using Velocity.Api.Contracts;
using Velocity.Core.Interfaces;
using Velocity.Data;

namespace Velocity.Api.Handlers;

public sealed class PlayerHandlers(IPlayerRepository players, VelocityDbContext db)
{
    public async ValueTask<IResult> GetProfile(Guid id, CancellationToken ct)
    {
        var player = await players.GetByIdAsync(id, ct);
        if (player is null)
            return Results.NotFound(ValidationMessages.PlayerNotFound);

        var totalRuns = await db.Runs
            .AsNoTracking()
            .CountAsync(r => r.PlayerId == id, ct);

        var mapsCreated = await db.GameMaps
            .AsNoTracking()
            .CountAsync(m => m.AuthorId == id, ct);

        var leaderboardEntries = await db.LeaderboardEntries
            .AsNoTracking()
            .CountAsync(e => e.PlayerId == id, ct);

        return Results.Ok(new PlayerProfileResponse(
            player.Id,
            player.Username,
            player.IsGuest,
            player.CreatedAt,
            totalRuns,
            mapsCreated,
            leaderboardEntries));
    }
}
