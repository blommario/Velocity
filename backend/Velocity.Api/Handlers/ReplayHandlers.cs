using System.Security.Claims;
using Velocity.Api.Configuration;
using Velocity.Api.Contracts;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

public sealed class ReplayHandlers(IRunRepository runs)
{
    public async ValueTask<IResult> Submit(Guid runId, SubmitReplayRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        if (string.IsNullOrWhiteSpace(request.ReplayDataJson))
            return Results.BadRequest(ValidationMessages.ReplayDataRequired);

        var run = await runs.GetByIdAsync(runId, ct);
        if (run is null)
            return Results.NotFound(ValidationMessages.RunNotFound);

        if (run.PlayerId != playerId)
            return Results.Problem(statusCode: 403, detail: ValidationMessages.RunNotOwned);

        run.ReplayDataJson = request.ReplayDataJson;
        run.HasReplay = true;
        await runs.UpdateAsync(run, ct);

        return Results.Ok(new ReplayResponse(run.Id, run.ReplayDataJson));
    }

    public async ValueTask<IResult> Get(Guid runId, CancellationToken ct)
    {
        var run = await runs.GetByIdAsync(runId, ct);
        if (run is null)
            return Results.NotFound(ValidationMessages.RunNotFound);

        if (run.ReplayDataJson is null)
            return Results.NotFound(ValidationMessages.ReplayNotFound);

        return Results.Ok(new ReplayResponse(run.Id, run.ReplayDataJson));
    }
}
