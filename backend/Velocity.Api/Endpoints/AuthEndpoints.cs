using Velocity.Api.Contracts;
using Velocity.Api.Handlers;

namespace Velocity.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Auth");

        group.MapPost("/register", (RegisterRequest request, AuthHandlers handler, CancellationToken ct)
            => handler.Register(request, ct));

        group.MapPost("/login", (LoginRequest request, AuthHandlers handler, CancellationToken ct)
            => handler.Login(request, ct));

        group.MapPost("/guest", (AuthHandlers handler, CancellationToken ct)
            => handler.Guest(ct));

        return group;
    }
}
