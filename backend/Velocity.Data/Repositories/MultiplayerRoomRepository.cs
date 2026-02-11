using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public sealed class MultiplayerRoomRepository(VelocityDbContext db) : IMultiplayerRoomRepository
{
    public async ValueTask<MultiplayerRoom?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await db.MultiplayerRooms
            .AsNoTracking()
            .Include(r => r.Map)
            .Include(r => r.Host)
            .Include(r => r.Participants)
                .ThenInclude(p => p.Player)
            .SingleOrDefaultAsync(r => r.Id == id, ct);

    public async ValueTask<IReadOnlyList<MultiplayerRoom>> GetActiveRoomsAsync(CancellationToken ct = default)
        => await db.MultiplayerRooms
            .AsNoTracking()
            .Include(r => r.Map)
            .Include(r => r.Host)
            .Include(r => r.Participants)
                .ThenInclude(p => p.Player)
            .Where(r => r.Status == MultiplayerRoomStatus.Waiting || r.Status == MultiplayerRoomStatus.Countdown)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

    public async ValueTask<MultiplayerRoom> CreateAsync(MultiplayerRoom room, CancellationToken ct = default)
    {
        db.MultiplayerRooms.Add(room);
        await db.SaveChangesAsync(ct);
        return room;
    }

    public async ValueTask UpdateAsync(MultiplayerRoom room, CancellationToken ct = default)
    {
        db.Entry(room).State = EntityState.Modified;
        await db.SaveChangesAsync(ct);
    }

    public async ValueTask AddParticipantAsync(MultiplayerParticipant participant, CancellationToken ct = default)
    {
        db.MultiplayerParticipants.Add(participant);
        await db.SaveChangesAsync(ct);
    }

    public async ValueTask<MultiplayerParticipant?> GetParticipantAsync(Guid roomId, Guid playerId, CancellationToken ct = default)
        => await db.MultiplayerParticipants
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.RoomId == roomId && p.PlayerId == playerId, ct);

    public async ValueTask UpdateParticipantAsync(MultiplayerParticipant participant, CancellationToken ct = default)
    {
        db.Entry(participant).State = EntityState.Modified;
        await db.SaveChangesAsync(ct);
    }

    public async ValueTask SaveResultAsync(MultiplayerResult result, CancellationToken ct = default)
    {
        db.MultiplayerResults.Add(result);
        await db.SaveChangesAsync(ct);
    }
}
