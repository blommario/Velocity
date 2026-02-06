using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface IMapRepository
{
    Task<GameMap?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<GameMap>> GetAllAsync(int page, int pageSize, bool? isOfficial, MapDifficulty? difficulty);
    Task<GameMap> CreateAsync(GameMap map);
    Task UpdateAsync(GameMap map);
    Task DeleteAsync(Guid id);
}
