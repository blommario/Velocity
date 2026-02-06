using System.Security.Claims;
using Velocity.Api.Configuration;
using Velocity.Api.Contracts;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

public sealed class RunHandlers(IRunRepository runs, IMapRepository maps, ILeaderboardRepository leaderboard)
{
    public async ValueTask<IResult> Submit(SubmitRunRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        if (request.Time is < ValidationRules.MinRunTime or > ValidationRules.MaxRunTime)
            return Results.BadRequest(ValidationMessages.RunInvalidTime);

        var map = await maps.GetByIdAsync(request.MapId, ct);
        if (map is null)
            return Results.BadRequest(ValidationMessages.RunInvalidMapId);

        var run = new Run
        {
            Id = Guid.NewGuid(),
            MapId = request.MapId,
            PlayerId = playerId,
            Time = request.Time,
            MaxSpeed = request.MaxSpeed,
            AverageSpeed = request.AverageSpeed,
            JumpCount = request.JumpCount,
            RocketJumps = request.RocketJumps,
            CompletedAt = DateTime.UtcNow,
        };

        await runs.CreateAsync(run, ct);

        // Update leaderboard (upsert — only saves if better than existing)
        var entry = new LeaderboardEntry
        {
            Id = Guid.NewGuid(),
            MapId = request.MapId,
            PlayerId = playerId,
            Time = request.Time,
            MaxSpeed = request.MaxSpeed,
            AverageSpeed = request.AverageSpeed,
            JumpCount = request.JumpCount,
            RocketJumps = request.RocketJumps,
            AchievedAt = DateTime.UtcNow,
            RunId = run.Id,
        };

        var leaderboardEntry = await leaderboard.UpsertAsync(entry, ct);
        var isPersonalBest = leaderboardEntry.RunId == run.Id;

        // Update map world record if this is the best time
        if (map.WorldRecordTime is null || request.Time < map.WorldRecordTime)
        {
            map.WorldRecordTime = request.Time;
            map.PlayCount++;
            map.UpdatedAt = DateTime.UtcNow;
            await maps.UpdateAsync(map, ct);
        }
        else
        {
            map.PlayCount++;
            map.UpdatedAt = DateTime.UtcNow;
            await maps.UpdateAsync(map, ct);
        }

        var playerName = user.FindFirstValue(ClaimTypes.Name) ?? ValidationRules.UnknownAuthorName;

        return Results.Created($"/api/runs/{run.Id}", new RunResponse(
            run.Id, run.MapId, run.PlayerId, playerName,
            run.Time, run.MaxSpeed, run.AverageSpeed,
            run.JumpCount, run.RocketJumps, run.CompletedAt, isPersonalBest));
    }

    public async ValueTask<IResult> GetById(Guid id, CancellationToken ct)
    {
        var run = await runs.GetByIdAsync(id, ct);
        if (run is null)
            return Results.NotFound(ValidationMessages.RunNotFound);

        return Results.Ok(new RunResponse(
            run.Id, run.MapId, run.PlayerId,
            run.Player?.Username ?? ValidationRules.UnknownAuthorName,
            run.Time, run.MaxSpeed, run.AverageSpeed,
            run.JumpCount, run.RocketJumps, run.CompletedAt, false));
    }

    public async ValueTask<IResult> GetByMap(Guid mapId, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var playerRuns = await runs.GetByMapAsync(mapId, playerId, ct);
        var playerName = user.FindFirstValue(ClaimTypes.Name) ?? ValidationRules.UnknownAuthorName;

        return Results.Ok(playerRuns.Select(r => new RunResponse(
            r.Id, r.MapId, r.PlayerId, playerName,
            r.Time, r.MaxSpeed, r.AverageSpeed,
            r.JumpCount, r.RocketJumps, r.CompletedAt, false)));
    }
}
