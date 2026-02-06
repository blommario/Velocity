using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public sealed class RunRepository(VelocityDbContext db) : IRunRepository
{
    public async ValueTask<Run?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await db.Runs
            .AsNoTracking()
            .Include(r => r.Player)
            .SingleOrDefaultAsync(r => r.Id == id, ct);

    public async ValueTask<IReadOnlyList<Run>> GetByMapAsync(Guid mapId, Guid playerId, CancellationToken ct = default)
        => await db.Runs
            .AsNoTracking()
            .Where(r => r.MapId == mapId && r.PlayerId == playerId)
            .OrderBy(r => r.Time)
            .ToListAsync(ct);

    public async ValueTask<Run> CreateAsync(Run run, CancellationToken ct = default)
    {
        db.Runs.Add(run);
        await db.SaveChangesAsync(ct);
        return run;
    }
}
