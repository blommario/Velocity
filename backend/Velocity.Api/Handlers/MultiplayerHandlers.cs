using System.Security.Claims;
using Velocity.Api.Configuration;
using Velocity.Api.Contracts;
using Velocity.Api.Services.Multiplayer;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

/// <summary>
/// CQRS handlers for multiplayer room lobby operations (REST).
/// Lifecycle events (countdown, match start) are delivered via WebTransport rooms.
/// </summary>
/// <remarks>
/// Depends on: IMultiplayerRoomRepository, IMapRepository, RoomManager
/// Used by: MultiplayerEndpoints
/// </remarks>
public sealed class MultiplayerHandlers(
    IMultiplayerRoomRepository rooms,
    IPlayerRepository players,
    IMapRepository maps,
    RoomManager roomManager)
{
    public async ValueTask<IResult> CreateRoom(CreateRoomRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var player = await players.GetByIdAsync(playerId, ct);
        if (player is null)
            return Results.Problem(statusCode: 401, detail: ValidationMessages.PlayerNotFound);

        var map = Guid.TryParse(request.MapId, out var mapGuid)
            ? await maps.GetByIdAsync(mapGuid, ct)
            : await maps.GetBySlugAsync(request.MapId, ct);
        if (map is null)
            return Results.BadRequest(ValidationMessages.RunInvalidMapId);

        var room = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            MapId = map.Id,
            HostPlayerId = playerId,
            Status = MultiplayerRoomStatus.Waiting,
            MaxPlayers = ValidationRules.MultiplayerMaxPlayers,
            CreatedAt = DateTime.UtcNow,
        };

        await rooms.CreateAsync(room, ct);

        // Add host as first participant
        var participant = new MultiplayerParticipant
        {
            Id = Guid.NewGuid(),
            RoomId = room.Id,
            PlayerId = playerId,
            IsReady = false,
            JoinedAt = DateTime.UtcNow,
        };

        await rooms.AddParticipantAsync(participant, ct);

        // Re-fetch to get navigation properties populated
        var created = await rooms.GetByIdAsync(room.Id, ct);
        return Results.Created($"/api/rooms/{room.Id}", ToResponse(created!));
    }

    public async ValueTask<IResult> GetRoom(Guid roomId, CancellationToken ct)
    {
        var room = await rooms.GetByIdAsync(roomId, ct);
        if (room is null)
            return Results.NotFound(ValidationMessages.RoomNotFound);

        return Results.Ok(ToResponse(room));
    }

    public async ValueTask<IResult> JoinRoom(Guid roomId, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var player = await players.GetByIdAsync(playerId, ct);
        if (player is null)
            return Results.Problem(statusCode: 401, detail: ValidationMessages.PlayerNotFound);

        var room = await rooms.GetByIdAsync(roomId, ct);
        if (room is null)
            return Results.NotFound(ValidationMessages.RoomNotFound);

        if (room.Status != MultiplayerRoomStatus.Waiting)
            return Results.Conflict(ValidationMessages.RoomNotWaiting);

        if (room.Participants.Count >= room.MaxPlayers)
            return Results.Conflict(ValidationMessages.RoomFull);

        var existing = await rooms.GetParticipantAsync(roomId, playerId, ct);
        if (existing is not null)
            return Results.Conflict(ValidationMessages.RoomAlreadyJoined);

        var participant = new MultiplayerParticipant
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            PlayerId = playerId,
            IsReady = false,
            JoinedAt = DateTime.UtcNow,
        };

        await rooms.AddParticipantAsync(participant, ct);

        var updated = await rooms.GetByIdAsync(roomId, ct);
        return Results.Ok(ToResponse(updated!));
    }

    public async ValueTask<IResult> SetReady(Guid roomId, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var room = await rooms.GetByIdAsync(roomId, ct);
        if (room is null)
            return Results.NotFound(ValidationMessages.RoomNotFound);

        if (room.Status != MultiplayerRoomStatus.Waiting)
            return Results.Conflict(ValidationMessages.RoomNotWaiting);

        var participant = await rooms.GetParticipantAsync(roomId, playerId, ct);
        if (participant is null)
            return Results.BadRequest(ValidationMessages.RoomNotParticipant);

        participant.IsReady = !participant.IsReady;
        await rooms.UpdateParticipantAsync(participant, ct);

        var updated = await rooms.GetByIdAsync(roomId, ct);
        return Results.Ok(ToResponse(updated!));
    }

    public async ValueTask<IResult> StartMatch(Guid roomId, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var room = await rooms.GetByIdAsync(roomId, ct);
        if (room is null)
            return Results.NotFound(ValidationMessages.RoomNotFound);

        if (room.HostPlayerId != playerId)
            return Results.Problem(statusCode: 403, detail: ValidationMessages.RoomNotHost);

        if (room.Status != MultiplayerRoomStatus.Waiting)
            return Results.Conflict(ValidationMessages.RoomAlreadyStarted);

        if (room.Participants.Count < ValidationRules.MultiplayerMinPlayers)
            return Results.BadRequest(ValidationMessages.RoomNotEnoughPlayers);

        var allReady = room.Participants.All(p => p.IsReady || p.PlayerId == room.HostPlayerId);
        if (!allReady)
            return Results.BadRequest(ValidationMessages.RoomNotAllReady);

        room.Status = MultiplayerRoomStatus.Countdown;
        room.StartedAt = DateTime.UtcNow;
        await rooms.UpdateAsync(room, ct);

        // Start countdown via transport room (3→2→1→GO→match_start)
        var transportRoom = roomManager.GetRoom(roomId);
        if (transportRoom is not null)
        {
            transportRoom.SetMetadata(room.HostPlayerId, room.MapId);
            transportRoom.StartCountdown();
        }

        var updated = await rooms.GetByIdAsync(roomId, ct);
        return Results.Ok(ToResponse(updated!));
    }

    public async ValueTask<IResult> GetActiveRooms(CancellationToken ct)
    {
        var activeRooms = await rooms.GetActiveRoomsAsync(ct);
        return Results.Ok(activeRooms.Select(ToResponse));
    }

    private static RoomResponse ToResponse(MultiplayerRoom room) => new(
        room.Id,
        room.MapId,
        room.Map?.Name ?? ValidationRules.UnknownAuthorName,
        room.HostPlayerId,
        room.Host?.Username ?? ValidationRules.UnknownAuthorName,
        room.Status,
        room.MaxPlayers,
        room.Participants.Count,
        room.CreatedAt,
        room.Participants.Select(p => new ParticipantResponse(
            p.PlayerId,
            p.Player?.Username ?? ValidationRules.UnknownAuthorName,
            p.IsReady,
            p.FinishTime)).ToList());
}
