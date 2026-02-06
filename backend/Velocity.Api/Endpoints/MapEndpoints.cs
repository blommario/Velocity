using System.Security.Claims;
using Velocity.Api.DTOs;
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
                int page = 1,
                int pageSize = 20,
                bool? isOfficial = null,
                MapDifficulty? difficulty = null)
            => handler.GetAll(page, pageSize, isOfficial, difficulty));

        group.MapGet("/{id:guid}", (Guid id, MapHandlers handler)
            => handler.GetById(id));

        group.MapPost("/", (CreateMapRequest request, ClaimsPrincipal user, MapHandlers handler)
            => handler.Create(request, user))
            .RequireAuthorization();

        return group;
    }
}
