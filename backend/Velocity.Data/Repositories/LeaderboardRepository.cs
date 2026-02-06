using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public sealed class LeaderboardRepository(VelocityDbContext db) : ILeaderboardRepository
{
    public async ValueTask<IReadOnlyList<LeaderboardEntry>> GetByMapAsync(Guid mapId, int limit, CancellationToken ct = default)
        => await db.LeaderboardEntries
            .AsNoTracking()
            .Include(e => e.Player)
            .Where(e => e.MapId == mapId)
            .OrderBy(e => e.Time)
            .Take(limit)
            .ToListAsync(ct);

    public async ValueTask<LeaderboardEntry?> GetPlayerBestAsync(Guid mapId, Guid playerId, CancellationToken ct = default)
        => await db.LeaderboardEntries
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.MapId == mapId && e.PlayerId == playerId, ct);

    public async ValueTask<LeaderboardEntry> UpsertAsync(LeaderboardEntry entry, CancellationToken ct = default)
    {
        var existing = await db.LeaderboardEntries
            .SingleOrDefaultAsync(e => e.MapId == entry.MapId && e.PlayerId == entry.PlayerId, ct);

        if (existing is null)
        {
            db.LeaderboardEntries.Add(entry);
        }
        else if (entry.Time < existing.Time)
        {
            existing.Time = entry.Time;
            existing.MaxSpeed = entry.MaxSpeed;
            existing.AverageSpeed = entry.AverageSpeed;
            existing.JumpCount = entry.JumpCount;
            existing.RocketJumps = entry.RocketJumps;
            existing.AchievedAt = entry.AchievedAt;
            existing.HasReplay = entry.HasReplay;
            existing.RunId = entry.RunId;
        }

        await db.SaveChangesAsync(ct);
        return existing ?? entry;
    }
}
