using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Velocity.Core.Entities;

namespace Velocity.Data.Configurations;

public class GameMapConfiguration : IEntityTypeConfiguration<GameMap>
{
    public void Configure(EntityTypeBuilder<GameMap> builder)
    {
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Name).HasMaxLength(100);
        builder.Property(m => m.Description).HasMaxLength(1000);

        builder.HasOne(m => m.Author)
            .WithMany(p => p.CreatedMaps)
            .HasForeignKey(m => m.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(m => m.IsOfficial);
        builder.HasIndex(m => m.Difficulty);
    }
}
