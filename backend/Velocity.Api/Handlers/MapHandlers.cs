using System.Security.Claims;
using Velocity.Api.Configuration;
using Velocity.Api.Contracts;
using Velocity.Core.Entities;
using Velocity.Core.Interfaces;

namespace Velocity.Api.Handlers;

public sealed class MapHandlers(IMapRepository maps)
{
    public async ValueTask<IResult> GetAll(
        int page = 1,
        int pageSize = 20,
        bool? isOfficial = null,
        MapDifficulty? difficulty = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        var results = await maps.GetAllAsync(page, pageSize, isOfficial, difficulty, ct);
        return Results.Ok(results.Select(ToResponse));
    }

    public async ValueTask<IResult> GetById(Guid id, CancellationToken ct)
    {
        var map = await maps.GetByIdAsync(id, ct);
        return map is null ? Results.NotFound() : Results.Ok(ToResponse(map));
    }

    public async ValueTask<IResult> Create(CreateMapRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(ValidationMessages.MapNameRequired);

        if (string.IsNullOrWhiteSpace(request.MapDataJson))
            return Results.BadRequest(ValidationMessages.MapDataRequired);

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

        await maps.CreateAsync(map, ct);
        return Results.Created($"/api/maps/{map.Id}", ToResponse(map));
    }

    public async ValueTask<IResult> Update(Guid id, UpdateMapRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var map = await maps.GetByIdAsync(id, ct);
        if (map is null)
            return Results.NotFound(ValidationMessages.MapNotFound);

        if (map.AuthorId != playerId)
            return Results.Problem(statusCode: 403, detail: ValidationMessages.MapNotAuthor);

        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(ValidationMessages.MapNameRequired);

        if (string.IsNullOrWhiteSpace(request.MapDataJson))
            return Results.BadRequest(ValidationMessages.MapDataRequired);

        map.Name = request.Name;
        map.Description = request.Description ?? string.Empty;
        map.Difficulty = request.Difficulty;
        map.MapDataJson = request.MapDataJson;
        map.UpdatedAt = DateTime.UtcNow;

        await maps.UpdateAsync(map, ct);
        return Results.Ok(ToResponse(map));
    }

    public async ValueTask<IResult> Delete(Guid id, ClaimsPrincipal user, CancellationToken ct)
    {
        var claimValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claimValue is null || !Guid.TryParse(claimValue, out var playerId))
            return Results.Problem(statusCode: 401, detail: ValidationMessages.InvalidCredentials);

        var map = await maps.GetByIdAsync(id, ct);
        if (map is null)
            return Results.NotFound(ValidationMessages.MapNotFound);

        if (map.AuthorId != playerId)
            return Results.Problem(statusCode: 403, detail: ValidationMessages.MapNotAuthor);

        await maps.DeleteAsync(id, ct);
        return Results.NoContent();
    }

    public async ValueTask<IResult> Like(Guid id, CancellationToken ct)
    {
        var map = await maps.GetByIdAsync(id, ct);
        if (map is null)
            return Results.NotFound(ValidationMessages.MapNotFound);

        map.LikeCount++;
        map.UpdatedAt = DateTime.UtcNow;
        await maps.UpdateAsync(map, ct);

        return Results.Ok(new { map.LikeCount });
    }

    private static MapResponse ToResponse(GameMap m) => new(
        m.Id, m.Name, m.Description,
        m.Author?.Username ?? ValidationRules.UnknownAuthorName,
        m.Difficulty, m.IsOfficial,
        m.PlayCount, m.LikeCount, m.WorldRecordTime,
        m.MapDataJson, m.CreatedAt);
}
