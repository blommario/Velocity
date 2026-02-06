namespace Velocity.Api.Configuration;

public sealed record JwtSettings
{
    public const string SectionName = "Jwt";
    public const int DefaultExpirationMinutes = 1440;

    public required string Key { get; init; }
    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public int ExpirationInMinutes { get; init; } = DefaultExpirationMinutes;
}
