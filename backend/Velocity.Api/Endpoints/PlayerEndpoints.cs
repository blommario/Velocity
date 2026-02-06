using Velocity.Api.Handlers;

namespace Velocity.Api.Endpoints;

public static class PlayerEndpoints
{
    public static RouteGroupBuilder MapPlayerEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/players")
            .WithTags("Players");

        group.MapGet("/{id:guid}/profile", (Guid id, PlayerHandlers handler, CancellationToken ct)
            => handler.GetProfile(id, ct));

        return group;
    }
}
