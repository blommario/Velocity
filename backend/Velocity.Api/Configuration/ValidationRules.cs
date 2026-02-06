namespace Velocity.Api.Configuration;

public static class ValidationRules
{
    public const int UsernameMinLength = 3;
    public const int UsernameMaxLength = 50;
    public const int PasswordMinLength = 6;
    public const string GuestNamePrefix = "Guest";
    public const int GuestNameSuffixLength = 8;
    public const string UnknownAuthorName = "Unknown";
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
}
