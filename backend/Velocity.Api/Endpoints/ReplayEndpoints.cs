using System.Security.Claims;
using Velocity.Api.Contracts;
using Velocity.Api.Handlers;

namespace Velocity.Api.Endpoints;

public static class ReplayEndpoints
{
    public static RouteGroupBuilder MapReplayEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/runs/{runId:guid}/replay")
            .WithTags("Replays");

        group.MapPost("/", (Guid runId, SubmitReplayRequest request, ClaimsPrincipal user, ReplayHandlers handler, CancellationToken ct)
            => handler.Submit(runId, request, user, ct))
            .RequireAuthorization();

        group.MapGet("/", (Guid runId, ReplayHandlers handler, CancellationToken ct)
            => handler.Get(runId, ct));

        return group;
    }
}
