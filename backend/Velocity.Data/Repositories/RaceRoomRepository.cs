using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public sealed class RaceRoomRepository(VelocityDbContext db) : IRaceRoomRepository
{
    public async ValueTask<RaceRoom?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await db.RaceRooms
            .AsNoTracking()
            .Include(r => r.Map)
            .Include(r => r.Host)
            .Include(r => r.Participants)
                .ThenInclude(p => p.Player)
            .SingleOrDefaultAsync(r => r.Id == id, ct);

    public async ValueTask<IReadOnlyList<RaceRoom>> GetActiveRoomsAsync(CancellationToken ct = default)
        => await db.RaceRooms
            .AsNoTracking()
            .Include(r => r.Map)
            .Include(r => r.Host)
            .Include(r => r.Participants)
                .ThenInclude(p => p.Player)
            .Where(r => r.Status == RaceRoomStatus.Waiting || r.Status == RaceRoomStatus.Countdown)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

    public async ValueTask<RaceRoom> CreateAsync(RaceRoom room, CancellationToken ct = default)
    {
        db.RaceRooms.Add(room);
        await db.SaveChangesAsync(ct);
        return room;
    }

    public async ValueTask UpdateAsync(RaceRoom room, CancellationToken ct = default)
    {
        db.RaceRooms.Update(room);
        await db.SaveChangesAsync(ct);
    }

    public async ValueTask AddParticipantAsync(RaceParticipant participant, CancellationToken ct = default)
    {
        db.RaceParticipants.Add(participant);
        await db.SaveChangesAsync(ct);
    }

    public async ValueTask<RaceParticipant?> GetParticipantAsync(Guid roomId, Guid playerId, CancellationToken ct = default)
        => await db.RaceParticipants
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.RoomId == roomId && p.PlayerId == playerId, ct);

    public async ValueTask UpdateParticipantAsync(RaceParticipant participant, CancellationToken ct = default)
    {
        db.RaceParticipants.Update(participant);
        await db.SaveChangesAsync(ct);
    }

    public async ValueTask SaveResultAsync(RaceResult result, CancellationToken ct = default)
    {
        db.RaceResults.Add(result);
        await db.SaveChangesAsync(ct);
    }
}
