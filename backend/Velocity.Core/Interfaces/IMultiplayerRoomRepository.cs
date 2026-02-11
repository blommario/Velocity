using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface IMultiplayerRoomRepository
{
    ValueTask<MultiplayerRoom?> GetByIdAsync(Guid id, CancellationToken ct = default);
    ValueTask<IReadOnlyList<MultiplayerRoom>> GetActiveRoomsAsync(CancellationToken ct = default);
    ValueTask<MultiplayerRoom> CreateAsync(MultiplayerRoom room, CancellationToken ct = default);
    ValueTask UpdateAsync(MultiplayerRoom room, CancellationToken ct = default);
    ValueTask AddParticipantAsync(MultiplayerParticipant participant, CancellationToken ct = default);
    ValueTask<MultiplayerParticipant?> GetParticipantAsync(Guid roomId, Guid playerId, CancellationToken ct = default);
    ValueTask UpdateParticipantAsync(MultiplayerParticipant participant, CancellationToken ct = default);
    ValueTask SaveResultAsync(MultiplayerResult result, CancellationToken ct = default);
}
