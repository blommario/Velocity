using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface IRunRepository
{
    Task<Run?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<Run>> GetByMapAsync(Guid mapId, Guid playerId);
    Task<Run> CreateAsync(Run run);
}
