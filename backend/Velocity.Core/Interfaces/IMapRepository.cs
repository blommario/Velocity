using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface IMapRepository
{
    ValueTask<GameMap?> GetByIdAsync(Guid id, CancellationToken ct = default);
    ValueTask<IReadOnlyList<GameMap>> GetAllAsync(int page, int pageSize, bool? isOfficial, MapDifficulty? difficulty, CancellationToken ct = default);
    ValueTask<GameMap> CreateAsync(GameMap map, CancellationToken ct = default);
    ValueTask UpdateAsync(GameMap map, CancellationToken ct = default);
    ValueTask DeleteAsync(Guid id, CancellationToken ct = default);
}
