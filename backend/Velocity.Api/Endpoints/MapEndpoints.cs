using System.Security.Claims;
using Velocity.Api.Contracts;
using Velocity.Api.Handlers;
using Velocity.Core.Entities;

namespace Velocity.Api.Endpoints;

public static class MapEndpoints
{
    public static RouteGroupBuilder MapMapEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/maps")
            .WithTags("Maps");

        group.MapGet("/", (MapHandlers handler,
                CancellationToken ct,
                int page = 1,
                int pageSize = 20,
                bool? isOfficial = null,
                MapDifficulty? difficulty = null)
            => handler.GetAll(page, pageSize, isOfficial, difficulty, ct));

        group.MapGet("/{id:guid}", (Guid id, MapHandlers handler, CancellationToken ct)
            => handler.GetById(id, ct));

        group.MapPost("/", (CreateMapRequest request, ClaimsPrincipal user, MapHandlers handler, CancellationToken ct)
            => handler.Create(request, user, ct))
            .RequireAuthorization();

        return group;
    }
}
