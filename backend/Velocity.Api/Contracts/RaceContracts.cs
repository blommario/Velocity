namespace Velocity.Api.Contracts;

public record CreateRoomRequest(string MapId);

public record RoomResponse(
    Guid Id,
    Guid MapId,
    string MapName,
    Guid HostPlayerId,
    string HostName,
    string Status,
    int MaxPlayers,
    int CurrentPlayers,
    DateTime CreatedAt,
    IReadOnlyList<ParticipantResponse> Participants);

public record ParticipantResponse(
    Guid PlayerId,
    string PlayerName,
    bool IsReady,
    float? FinishTime);
