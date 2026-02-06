using System.Security.Claims;
using Velocity.Api.Contracts;
using Velocity.Api.Handlers;

namespace Velocity.Api.Endpoints;

public static class RunEndpoints
{
    public static RouteGroupBuilder MapRunEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/runs")
            .WithTags("Runs");

        group.MapPost("/", (SubmitRunRequest request, ClaimsPrincipal user, RunHandlers handler, CancellationToken ct)
            => handler.Submit(request, user, ct))
            .RequireAuthorization();

        group.MapGet("/{id:guid}", (Guid id, RunHandlers handler, CancellationToken ct)
            => handler.GetById(id, ct));

        group.MapGet("/map/{mapId:guid}", (Guid mapId, ClaimsPrincipal user, RunHandlers handler, CancellationToken ct)
            => handler.GetByMap(mapId, user, ct))
            .RequireAuthorization();

        return group;
    }
}
