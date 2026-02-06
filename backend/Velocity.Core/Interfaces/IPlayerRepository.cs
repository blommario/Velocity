using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface IPlayerRepository
{
    Task<Player?> GetByIdAsync(Guid id);
    Task<Player?> GetByUsernameAsync(string username);
    Task<Player> CreateAsync(Player player);
    Task UpdateAsync(Player player);
}
