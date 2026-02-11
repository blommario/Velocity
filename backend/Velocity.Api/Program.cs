using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Velocity.Api.Configuration;
using Velocity.Api.Endpoints;
using Velocity.Api.Handlers;
using Velocity.Api.Services;
using Velocity.Api.Services.Multiplayer;
using Velocity.Core.Interfaces;
using Velocity.Data;
using Velocity.Data.Repositories;

var builder = WebApplication.CreateBuilder(args);

// ── JWT Settings (Options pattern) ──
var jwtSection = builder.Configuration.GetSection(JwtSettings.SectionName);
builder.Services.Configure<JwtSettings>(jwtSection);
var jwtSettings = jwtSection.Get<JwtSettings>()
    ?? throw new InvalidOperationException("JWT configuration is missing.");

// ── Database ──
builder.Services.AddDbContext<VelocityDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

// ── Authentication ──
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.Key)),
        };
    });
builder.Services.AddAuthorization();

// ── CORS ──
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("https://localhost:5173", "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ── Response compression ──
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});

// ── Rate limiting ──
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter(RateLimitPolicies.Auth, limiter =>
    {
        limiter.PermitLimit = RateLimitPolicies.AuthPermitLimit;
        limiter.Window = RateLimitPolicies.AuthWindow;
        limiter.QueueLimit = 0;
    });
});

// ── Health checks ──
builder.Services.AddHealthChecks()
    .AddDbContextCheck<VelocityDbContext>();

// ── OpenAPI ──
builder.Services.AddOpenApi();

// ── Services ──
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<SseConnectionManager>();
builder.Services.AddSingleton<RoomManager>();
builder.Services.AddSingleton<MetricsCollector>();
builder.Services.AddHostedService<MetricsCollector>(sp => sp.GetRequiredService<MetricsCollector>());
builder.Services.AddHostedService<RoomCleanupService>();
builder.Services.AddScoped<IPlayerRepository, PlayerRepository>();
builder.Services.AddScoped<IMapRepository, MapRepository>();
builder.Services.AddScoped<IRunRepository, RunRepository>();
builder.Services.AddScoped<ILeaderboardRepository, LeaderboardRepository>();
builder.Services.AddScoped<IMultiplayerRoomRepository, MultiplayerRoomRepository>();

// ── Handlers (CQRS) ──
builder.Services.AddScoped<AuthHandlers>();
builder.Services.AddScoped<MapHandlers>();
builder.Services.AddScoped<RunHandlers>();
builder.Services.AddScoped<LeaderboardHandlers>();
builder.Services.AddScoped<PlayerHandlers>();
builder.Services.AddScoped<ReplayHandlers>();
builder.Services.AddScoped<MultiplayerHandlers>();

// ── Problem details for consistent error responses ──
builder.Services.AddProblemDetails();

var app = builder.Build();

// ── Auto-create DB + seed in development ──
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<VelocityDbContext>();
    db.Database.EnsureCreated();

    // DEV: clear stale multiplayer data on startup so rooms don't linger across restarts
    db.MultiplayerResults.RemoveRange(db.MultiplayerResults);
    db.MultiplayerParticipants.RemoveRange(db.MultiplayerParticipants);
    db.MultiplayerRooms.RemoveRange(db.MultiplayerRooms);
    await db.SaveChangesAsync();

    await DatabaseSeeder.SeedAsync(db);
}

// ── Middleware pipeline ──
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseResponseCompression();
app.UseWebSockets();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// ── OpenAPI endpoint (dev only) ──
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// ── Health check ──
app.MapHealthChecks("/api/health");

// ── API endpoints ──
app.MapAuthEndpoints()
    .RequireRateLimiting(RateLimitPolicies.Auth);

app.MapMapEndpoints();
app.MapRunEndpoints();
app.MapLeaderboardEndpoints();
app.MapPlayerEndpoints();
app.MapReplayEndpoints();
app.MapMultiplayerEndpoints();
app.MapSseEndpoints();
app.MapWebSocketEndpoints();
app.MapMetricsEndpoints();

app.Run();
