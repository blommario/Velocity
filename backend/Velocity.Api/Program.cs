using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Velocity.Api.Endpoints;
using Velocity.Api.Handlers;
using Velocity.Api.Services;
using Velocity.Core.Interfaces;
using Velocity.Data;
using Velocity.Data.Repositories;

var builder = WebApplication.CreateBuilder(args);

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
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
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

    options.AddFixedWindowLimiter("auth", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
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
builder.Services.AddScoped<IPlayerRepository, PlayerRepository>();
builder.Services.AddScoped<IMapRepository, MapRepository>();
builder.Services.AddScoped<IRunRepository, RunRepository>();

// ── Handlers (CQRS) ──
builder.Services.AddScoped<AuthHandlers>();
builder.Services.AddScoped<MapHandlers>();

// ── Problem details for consistent error responses ──
builder.Services.AddProblemDetails();

var app = builder.Build();

// ── Auto-create DB in development ──
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<VelocityDbContext>();
    db.Database.EnsureCreated();
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
app.MapHealthChecks("/health");

// ── API endpoints ──
app.MapAuthEndpoints()
    .RequireRateLimiting("auth");

app.MapMapEndpoints();

app.Run();
