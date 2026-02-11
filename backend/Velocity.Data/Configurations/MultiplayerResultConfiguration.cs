using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Velocity.Core.Entities;

namespace Velocity.Data.Configurations;

public class MultiplayerResultConfiguration : IEntityTypeConfiguration<MultiplayerResult>
{
    public void Configure(EntityTypeBuilder<MultiplayerResult> builder)
    {
        builder.HasKey(r => r.Id);
        builder.Property(r => r.GameMode).HasMaxLength(20);

        builder.HasOne(r => r.Room)
            .WithMany()
            .HasForeignKey(r => r.RoomId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Map)
            .WithMany()
            .HasForeignKey(r => r.MapId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Player)
            .WithMany()
            .HasForeignKey(r => r.PlayerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(r => new { r.MapId, r.PlayerId });
        builder.HasIndex(r => r.RoomId);
    }
}
