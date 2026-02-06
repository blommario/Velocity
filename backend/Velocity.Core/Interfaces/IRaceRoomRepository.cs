using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface IRaceRoomRepository
{
    ValueTask<RaceRoom?> GetByIdAsync(Guid id, CancellationToken ct = default);
    ValueTask<IReadOnlyList<RaceRoom>> GetActiveRoomsAsync(CancellationToken ct = default);
    ValueTask<RaceRoom> CreateAsync(RaceRoom room, CancellationToken ct = default);
    ValueTask UpdateAsync(RaceRoom room, CancellationToken ct = default);
    ValueTask AddParticipantAsync(RaceParticipant participant, CancellationToken ct = default);
    ValueTask<RaceParticipant?> GetParticipantAsync(Guid roomId, Guid playerId, CancellationToken ct = default);
    ValueTask UpdateParticipantAsync(RaceParticipant participant, CancellationToken ct = default);
}
