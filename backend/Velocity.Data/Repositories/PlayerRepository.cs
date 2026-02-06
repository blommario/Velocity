using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public sealed class PlayerRepository(VelocityDbContext db) : IPlayerRepository
{
    public async ValueTask<Player?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await db.Players.FindAsync([id], ct);

    public async ValueTask<Player?> GetByUsernameAsync(string username, CancellationToken ct = default)
        => await db.Players.SingleOrDefaultAsync(p => p.Username == username, ct);

    public async ValueTask<Player> CreateAsync(Player player, CancellationToken ct = default)
    {
        db.Players.Add(player);
        await db.SaveChangesAsync(ct);
        return player;
    }

    public async ValueTask UpdateAsync(Player player, CancellationToken ct = default)
    {
        db.Players.Update(player);
        await db.SaveChangesAsync(ct);
    }
}
