using System.Security.Claims;
using Velocity.Api.Configuration;
using Velocity.Api.Contracts;
using Velocity.Api.Services;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

public sealed class RaceHandlers(
    IRaceRoomRepository rooms,
    IMapRepository maps,
    SseConnectionManager sse)
{
    public async ValueTask<IResult> CreateRoom(CreateRoomRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var map = await maps.GetByIdAsync(request.MapId, ct);
        if (map is null)
            return Results.BadRequest(ValidationMessages.RunInvalidMapId);

        var room = new RaceRoom
        {
            Id = Guid.NewGuid(),
            MapId = request.MapId,
            HostPlayerId = playerId,
            Status = RaceRoomStatus.Waiting,
            MaxPlayers = ValidationRules.RaceMaxPlayers,
            CreatedAt = DateTime.UtcNow,
        };

        await rooms.CreateAsync(room, ct);

        // Add host as first participant
        var participant = new RaceParticipant
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

        var room = await rooms.GetByIdAsync(roomId, ct);
        if (room is null)
            return Results.NotFound(ValidationMessages.RoomNotFound);

        if (room.Status != RaceRoomStatus.Waiting)
            return Results.Conflict(ValidationMessages.RoomNotWaiting);

        if (room.Participants.Count >= room.MaxPlayers)
            return Results.Conflict(ValidationMessages.RoomFull);

        var existing = await rooms.GetParticipantAsync(roomId, playerId, ct);
        if (existing is not null)
            return Results.Conflict(ValidationMessages.RoomAlreadyJoined);

        var participant = new RaceParticipant
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            PlayerId = playerId,
            IsReady = false,
            JoinedAt = DateTime.UtcNow,
        };

        await rooms.AddParticipantAsync(participant, ct);

        var playerName = user.FindFirstValue(ClaimTypes.Name) ?? ValidationRules.UnknownAuthorName;

        await sse.BroadcastAsync(
            SseChannels.Race(roomId),
            SseEvents.PlayerJoined,
            new { PlayerId = playerId, PlayerName = playerName },
            ct);

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

        if (room.Status != RaceRoomStatus.Waiting)
            return Results.Conflict(ValidationMessages.RoomNotWaiting);

        var participant = await rooms.GetParticipantAsync(roomId, playerId, ct);
        if (participant is null)
            return Results.BadRequest(ValidationMessages.RoomNotParticipant);

        participant.IsReady = !participant.IsReady;
        await rooms.UpdateParticipantAsync(participant, ct);

        var playerName = user.FindFirstValue(ClaimTypes.Name) ?? ValidationRules.UnknownAuthorName;

        await sse.BroadcastAsync(
            SseChannels.Race(roomId),
            SseEvents.PlayerReady,
            new { PlayerId = playerId, PlayerName = playerName, participant.IsReady },
            ct);

        var updated = await rooms.GetByIdAsync(roomId, ct);
        return Results.Ok(ToResponse(updated!));
    }

    public async ValueTask<IResult> StartRace(Guid roomId, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var room = await rooms.GetByIdAsync(roomId, ct);
        if (room is null)
            return Results.NotFound(ValidationMessages.RoomNotFound);

        if (room.HostPlayerId != playerId)
            return Results.Problem(statusCode: 403, detail: ValidationMessages.RoomNotHost);

        if (room.Status != RaceRoomStatus.Waiting)
            return Results.Conflict(ValidationMessages.RoomAlreadyStarted);

        if (room.Participants.Count < ValidationRules.RaceMinPlayers)
            return Results.BadRequest(ValidationMessages.RoomNotEnoughPlayers);

        var allReady = room.Participants.All(p => p.IsReady || p.PlayerId == room.HostPlayerId);
        if (!allReady)
            return Results.BadRequest(ValidationMessages.RoomNotAllReady);

        room.Status = RaceRoomStatus.Countdown;
        room.StartedAt = DateTime.UtcNow;
        await rooms.UpdateAsync(room, ct);

        await sse.BroadcastAsync(
            SseChannels.Race(roomId),
            SseEvents.RaceStarting,
            new { RoomId = roomId, StartedAt = room.StartedAt },
            ct);

        var updated = await rooms.GetByIdAsync(roomId, ct);
        return Results.Ok(ToResponse(updated!));
    }

    public async ValueTask<IResult> GetActiveRooms(CancellationToken ct)
    {
        var activeRooms = await rooms.GetActiveRoomsAsync(ct);
        return Results.Ok(activeRooms.Select(ToResponse));
    }

    private static RoomResponse ToResponse(RaceRoom room) => new(
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

internal static class SseChannels
{
    public static string Race(Guid roomId) => $"race:{roomId}";
    public static string Leaderboard(Guid mapId) => $"leaderboard:{mapId}";
    public const string Activity = "activity";
}

internal static class SseEvents
{
    public const string PlayerJoined = "player_joined";
    public const string PlayerReady = "player_ready";
    public const string RaceStarting = "race_starting";
    public const string RaceFinished = "race_finished";
    public const string PositionUpdate = "position_update";
    public const string LeaderboardUpdate = "leaderboard_update";
    public const string ActivityUpdate = "activity_update";
}
