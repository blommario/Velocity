using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public class RunRepository(VelocityDbContext db) : IRunRepository
{
    public async Task<Run?> GetByIdAsync(Guid id)
        => await db.Runs.Include(r => r.Player).FirstOrDefaultAsync(r => r.Id == id);

    public async Task<IReadOnlyList<Run>> GetByMapAsync(Guid mapId, Guid playerId)
        => await db.Runs
            .Where(r => r.MapId == mapId && r.PlayerId == playerId)
            .OrderBy(r => r.Time)
            .ToListAsync();

    public async Task<Run> CreateAsync(Run run)
    {
        db.Runs.Add(run);
        await db.SaveChangesAsync();
        return run;
    }
}
