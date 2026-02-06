using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface IRunRepository
{
    ValueTask<Run?> GetByIdAsync(Guid id, CancellationToken ct = default);
    ValueTask<IReadOnlyList<Run>> GetByMapAsync(Guid mapId, Guid playerId, CancellationToken ct = default);
    ValueTask<Run> CreateAsync(Run run, CancellationToken ct = default);
    ValueTask UpdateAsync(Run run, CancellationToken ct = default);
}
