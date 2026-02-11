using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Velocity.Core.Entities;

namespace Velocity.Data.Configurations;

public class RaceRoomConfiguration : IEntityTypeConfiguration<RaceRoom>
{
    public void Configure(EntityTypeBuilder<RaceRoom> builder)
    {
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Status).HasMaxLength(20);

        builder.HasOne(r => r.Map)
            .WithMany()
            .HasForeignKey(r => r.MapId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Host)
            .WithMany(p => p.HostedRooms)
            .HasForeignKey(r => r.HostPlayerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(r => r.Status);
    }
}
