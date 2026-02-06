using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public class MapRepository(VelocityDbContext db) : IMapRepository
{
    public async Task<GameMap?> GetByIdAsync(Guid id)
        => await db.GameMaps.Include(m => m.Author).FirstOrDefaultAsync(m => m.Id == id);

    public async Task<IReadOnlyList<GameMap>> GetAllAsync(
        int page, int pageSize, bool? isOfficial, MapDifficulty? difficulty)
    {
        var query = db.GameMaps.Include(m => m.Author).AsQueryable();

        if (isOfficial.HasValue)
            query = query.Where(m => m.IsOfficial == isOfficial.Value);

        if (difficulty.HasValue)
            query = query.Where(m => m.Difficulty == difficulty.Value);

        return await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<GameMap> CreateAsync(GameMap map)
    {
        db.GameMaps.Add(map);
        await db.SaveChangesAsync();
        return map;
    }

    public async Task UpdateAsync(GameMap map)
    {
        db.GameMaps.Update(map);
        await db.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var map = await db.GameMaps.FindAsync(id);
        if (map is not null)
        {
            db.GameMaps.Remove(map);
            await db.SaveChangesAsync();
        }
    }
}
