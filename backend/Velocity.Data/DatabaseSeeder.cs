/// <summary>
/// Seeds the database with a system player and official maps on first run.
/// Idempotent — skips rows that already exist.
///
/// Depends on: VelocityDbContext, Velocity.Core.Entities
/// Used by: Program.cs (startup)
/// </summary>
using Microsoft.EntityFrameworkCore;
using Velocity.Core.Entities;

namespace Velocity.Data;

public static class DatabaseSeeder
{
    /// <summary>Deterministic ID for the "System" player that owns official maps.</summary>
    public static readonly Guid SystemPlayerId = new("00000000-0000-0000-0000-000000000001");

    public static async Task SeedAsync(VelocityDbContext db, CancellationToken ct = default)
    {
        await SeedSystemPlayerAsync(db, ct);
        await SeedOfficialMapsAsync(db, ct);
    }

    private static async Task SeedSystemPlayerAsync(VelocityDbContext db, CancellationToken ct)
    {
        var exists = await db.Players.AnyAsync(p => p.Id == SystemPlayerId, ct);
        if (exists) return;

        db.Players.Add(new Player
        {
            Id = SystemPlayerId,
            Username = "Velocity",
            PasswordHash = string.Empty,
            IsGuest = false,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedOfficialMapsAsync(VelocityDbContext db, CancellationToken ct)
    {
        foreach (var seed in OfficialMapSeeds)
        {
            var exists = await db.GameMaps.AnyAsync(m => m.Slug == seed.Slug, ct);
            if (exists) continue;

            db.GameMaps.Add(new GameMap
            {
                Id = seed.Id,
                Slug = seed.Slug,
                Name = seed.Name,
                Description = seed.Description,
                AuthorId = SystemPlayerId,
                Difficulty = seed.Difficulty,
                IsOfficial = true,
                MapDataJson = "{}",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    private static readonly OfficialMapSeed[] OfficialMapSeeds =
    [
        new(
            new Guid("11111111-1111-1111-1111-111111111001"),
            "first-steps",
            "First Steps",
            "Tutorial: corridors, curves, small gaps. Learn the basics of movement.",
            MapDifficulty.Easy),
    ];

    private sealed record OfficialMapSeed(Guid Id, string Slug, string Name, string Description, MapDifficulty Difficulty);
}
