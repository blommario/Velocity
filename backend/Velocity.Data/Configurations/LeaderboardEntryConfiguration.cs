using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Velocity.Core.Entities;

namespace Velocity.Data.Configurations;

public class LeaderboardEntryConfiguration : IEntityTypeConfiguration<LeaderboardEntry>
{
    public void Configure(EntityTypeBuilder<LeaderboardEntry> builder)
    {
        builder.HasKey(e => e.Id);

        builder.HasOne(e => e.Map)
            .WithMany(m => m.LeaderboardEntries)
            .HasForeignKey(e => e.MapId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Player)
            .WithMany(p => p.LeaderboardEntries)
            .HasForeignKey(e => e.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Run)
            .WithMany()
            .HasForeignKey(e => e.RunId)
            .OnDelete(DeleteBehavior.SetNull);

        // Fast leaderboard queries: sorted by time per map
        builder.HasIndex(e => new { e.MapId, e.Time });
    }
}
