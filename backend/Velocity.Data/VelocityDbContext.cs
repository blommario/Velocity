using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;

namespace Velocity.Data;

public class VelocityDbContext(DbContextOptions<VelocityDbContext> options) : DbContext(options)
{
    public DbSet<Player> Players => Set<Player>();
    public DbSet<GameMap> GameMaps => Set<GameMap>();
    public DbSet<Run> Runs => Set<Run>();
    public DbSet<LeaderboardEntry> LeaderboardEntries => Set<LeaderboardEntry>();
    public DbSet<RaceRoom> RaceRooms => Set<RaceRoom>();
    public DbSet<RaceParticipant> RaceParticipants => Set<RaceParticipant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(VelocityDbContext).Assembly);
    }
}
