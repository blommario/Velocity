namespace Velocity.Api.Configuration;

public static class ValidationRules
{
    public const int UsernameMinLength = 3;
    public const int UsernameMaxLength = 50;
    public const int PasswordMinLength = 6;
    public const string GuestNamePrefix = "Guest";
    public const int GuestNameSuffixLength = 8;
    public const string UnknownAuthorName = "Unknown";

    // Maps
    public const int MapNameMaxLength = 100;
    public const int MapDescriptionMaxLength = 1000;

    // Runs
    public const float MinRunTime = 0.1f;
    public const float MaxRunTime = 3600f; // 1 hour

    // Leaderboard
    public const int LeaderboardMaxEntries = 100;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
}

public static class ValidationMessages
{
    public const string UsernameMinLength = "Username must be at least 3 characters.";
    public const string UsernameMaxLength = "Username must be at most 50 characters.";
    public const string PasswordMinLength = "Password must be at least 6 characters.";
    public const string UsernameTaken = "Username already taken.";
    public const string InvalidCredentials = "Invalid username or password.";
    public const string MapNameRequired = "Map name is required.";
    public const string MapDataRequired = "Map data is required.";
    public const string MapNotFound = "Map not found.";
    public const string MapNotAuthor = "You are not the author of this map.";
    public const string RunInvalidTime = "Run time must be between 0.1 and 3600 seconds.";
    public const string RunInvalidMapId = "Invalid map ID.";
    public const string RunNotFound = "Run not found.";
    public const string PlayerNotFound = "Player not found.";
    public const string ReplayDataRequired = "Replay data is required.";
    public const string ReplayNotFound = "Replay not found for this run.";
    public const string RunNotOwned = "You do not own this run.";
}
