using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Velocity.Core.Entities;

namespace Velocity.Data.Configurations;

public class RunConfiguration : IEntityTypeConfiguration<Run>
{
    public void Configure(EntityTypeBuilder<Run> builder)
    {
        builder.HasKey(r => r.Id);

        builder.HasOne(r => r.Map)
            .WithMany(m => m.Runs)
            .HasForeignKey(r => r.MapId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Player)
            .WithMany(p => p.Runs)
            .HasForeignKey(r => r.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => new { r.MapId, r.PlayerId });
    }
}
