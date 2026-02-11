using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Velocity.Core.Entities;

namespace Velocity.Data.Configurations;

public class RaceParticipantConfiguration : IEntityTypeConfiguration<RaceParticipant>
{
    public void Configure(EntityTypeBuilder<RaceParticipant> builder)
    {
        builder.HasKey(p => p.Id);

        builder.HasOne(p => p.Room)
            .WithMany(r => r.Participants)
            .HasForeignKey(p => p.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.Player)
            .WithMany(pl => pl.RaceParticipations)
            .HasForeignKey(p => p.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => new { p.RoomId, p.PlayerId }).IsUnique();
    }
}
