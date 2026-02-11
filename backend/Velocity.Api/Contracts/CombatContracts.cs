namespace Velocity.Api.Contracts;

/// <summary>
/// WebSocket JSON message types for the combat system.
/// </summary>
/// <remarks>
/// Used by: Room (hit handling, broadcast), Frontend (multiplayerStore)
/// </remarks>
public static class CombatMessageTypes
{
    public const string Hit = "hit";
    public const string PlayerDamaged = "player_damaged";
    public const string PlayerKilled = "player_killed";
    public const string PlayerRespawned = "player_respawned";
}

/// <summary>
/// Hitbox zone identifiers for damage multiplier resolution.
/// </summary>
/// <remarks>
/// Used by: Room (hit validation), Frontend (RemotePlayerHitbox, weaponFire)
/// </remarks>
public static class HitboxZones
{
    public const string Head = "head";
    public const string Torso = "torso";
    public const string Limb = "limb";
}
