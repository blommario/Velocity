using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Velocity.Core.Entities;

namespace Velocity.Data.Configurations;

public class PlayerConfiguration : IEntityTypeConfiguration<Player>
{
    public void Configure(EntityTypeBuilder<Player> builder)
    {
        builder.HasKey(p => p.Id);
        builder.HasIndex(p => p.Username).IsUnique();
        builder.Property(p => p.Username).HasMaxLength(50);
        builder.Property(p => p.PasswordHash).HasMaxLength(256);
    }
}
