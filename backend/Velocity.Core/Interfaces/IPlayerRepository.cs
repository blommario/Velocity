using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface IPlayerRepository
{
    ValueTask<Player?> GetByIdAsync(Guid id, CancellationToken ct = default);
    ValueTask<Player?> GetByUsernameAsync(string username, CancellationToken ct = default);
    ValueTask<Player> CreateAsync(Player player, CancellationToken ct = default);
    ValueTask UpdateAsync(Player player, CancellationToken ct = default);
}
