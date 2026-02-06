using Velocity.Api.Contracts;
using Velocity.Api.Handlers;

namespace Velocity.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Auth");

        group.MapPost("/register", (RegisterRequest request, AuthHandlers handler)
            => handler.Register(request));

        group.MapPost("/login", (LoginRequest request, AuthHandlers handler)
            => handler.Login(request));

        group.MapPost("/guest", (AuthHandlers handler)
            => handler.Guest());

        return group;
    }
}
