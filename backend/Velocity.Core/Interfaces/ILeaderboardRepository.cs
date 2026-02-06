using Velocity.Core.Entities;

namespace Velocity.Core.Interfaces;

public interface ILeaderboardRepository
{
    ValueTask<IReadOnlyList<LeaderboardEntry>> GetByMapAsync(Guid mapId, int limit, CancellationToken ct = default);
    ValueTask<LeaderboardEntry?> GetPlayerBestAsync(Guid mapId, Guid playerId, CancellationToken ct = default);
    ValueTask<LeaderboardEntry> UpsertAsync(LeaderboardEntry entry, CancellationToken ct = default);
}
