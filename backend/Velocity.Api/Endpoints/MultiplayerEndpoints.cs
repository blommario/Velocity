using System.Security.Claims;
using Velocity.Api.Contracts;
using Velocity.Api.Handlers;

namespace Velocity.Api.Endpoints;

public static class RaceEndpoints
{
    public static RouteGroupBuilder MapRaceEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/rooms")
            .WithTags("Rooms")
            .RequireAuthorization();

        group.MapPost("/", (CreateRoomRequest request, ClaimsPrincipal user, RaceHandlers handler, CancellationToken ct)
            => handler.CreateRoom(request, user, ct));

        group.MapGet("/", (RaceHandlers handler, CancellationToken ct)
            => handler.GetActiveRooms(ct))
            .AllowAnonymous();

        group.MapGet("/{id:guid}", (Guid id, RaceHandlers handler, CancellationToken ct)
            => handler.GetRoom(id, ct))
            .AllowAnonymous();

        group.MapPost("/{id:guid}/join", (Guid id, ClaimsPrincipal user, RaceHandlers handler, CancellationToken ct)
            => handler.JoinRoom(id, user, ct));

        group.MapPost("/{id:guid}/ready", (Guid id, ClaimsPrincipal user, RaceHandlers handler, CancellationToken ct)
            => handler.SetReady(id, user, ct));

        group.MapPost("/{id:guid}/start", (Guid id, ClaimsPrincipal user, RaceHandlers handler, CancellationToken ct)
            => handler.StartRace(id, user, ct));

        return group;
    }
}
