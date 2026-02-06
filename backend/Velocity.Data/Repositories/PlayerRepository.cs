using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Data.Repositories;

public class PlayerRepository(VelocityDbContext db) : IPlayerRepository
{
    public async Task<Player?> GetByIdAsync(Guid id)
        => await db.Players.FindAsync(id);

    public async Task<Player?> GetByUsernameAsync(string username)
        => await db.Players.FirstOrDefaultAsync(p => p.Username == username);

    public async Task<Player> CreateAsync(Player player)
    {
        db.Players.Add(player);
        await db.SaveChangesAsync();
        return player;
    }

    public async Task UpdateAsync(Player player)
    {
        db.Players.Update(player);
        await db.SaveChangesAsync();
    }
}
