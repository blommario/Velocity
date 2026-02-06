using System.Security.Claims;
using Velocity.Api.DTOs;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

public class MapHandlers(IMapRepository maps)
{
    public async ValueTask<IResult> GetAll(
        int page = 1,
        int pageSize = 20,
        bool? isOfficial = null,
        MapDifficulty? difficulty = null)
    {
        var results = await maps.GetAllAsync(page, pageSize, isOfficial, difficulty);
        return Results.Ok(results.Select(ToDto));
    }

    public async ValueTask<IResult> GetById(Guid id)
    {
        var map = await maps.GetByIdAsync(id);
        return map is null ? Results.NotFound() : Results.Ok(ToDto(map));
    }

    public async ValueTask<IResult> Create(CreateMapRequest request, ClaimsPrincipal user)
    {
        var playerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest("Map name is required.");

        if (string.IsNullOrWhiteSpace(request.MapDataJson))
            return Results.BadRequest("Map data is required.");

        var map = new GameMap
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description ?? string.Empty,
            AuthorId = playerId,
            Difficulty = request.Difficulty,
            IsOfficial = false,
            MapDataJson = request.MapDataJson,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await maps.CreateAsync(map);
        return Results.Created($"/api/maps/{map.Id}", ToDto(map));
    }

    private static MapDto ToDto(GameMap m) => new(
        m.Id, m.Name, m.Description,
        m.Author?.Username ?? "Unknown",
        m.Difficulty, m.IsOfficial,
        m.PlayCount, m.LikeCount, m.WorldRecordTime,
        m.MapDataJson, m.CreatedAt);
}
