using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public sealed class MapRepository(VelocityDbContext db) : IMapRepository
{
    public async ValueTask<GameMap?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await db.GameMaps
            .AsNoTracking()
            .Include(m => m.Author)
            .SingleOrDefaultAsync(m => m.Id == id, ct);

    public async ValueTask<GameMap?> GetBySlugAsync(string slug, CancellationToken ct = default)
        => await db.GameMaps
            .AsNoTracking()
            .Include(m => m.Author)
            .SingleOrDefaultAsync(m => m.Slug == slug, ct);

    public async ValueTask<IReadOnlyList<GameMap>> GetAllAsync(
        int page, int pageSize, bool? isOfficial, MapDifficulty? difficulty, CancellationToken ct = default)
    {
        var query = db.GameMaps
            .AsNoTracking()
            .Include(m => m.Author)
            .AsQueryable();

        if (isOfficial.HasValue)
            query = query.Where(m => m.IsOfficial == isOfficial.Value);

        if (difficulty.HasValue)
            query = query.Where(m => m.Difficulty == difficulty.Value);

        return await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
    }

    public async ValueTask<GameMap> CreateAsync(GameMap map, CancellationToken ct = default)
    {
        db.GameMaps.Add(map);
        await db.SaveChangesAsync(ct);
        return map;
    }

    public async ValueTask UpdateAsync(GameMap map, CancellationToken ct = default)
    {
        db.GameMaps.Update(map);
        await db.SaveChangesAsync(ct);
    }

    public async ValueTask DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var map = await db.GameMaps.FindAsync([id], ct);
        if (map is not null)
        {
            db.GameMaps.Remove(map);
            await db.SaveChangesAsync(ct);
        }
    }
}
