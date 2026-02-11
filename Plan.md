Context
Multiplayer is functional for position sync and race lifecycle, but all combat damage is purely local. When you shoot another player, they take no damage because:

Remote players have no physics colliders (raycasts pass through them)
No network protocol for hit/damage events exists
Server has no concept of player health
Frontend doesn't track remote player health

Approach: Client-authoritative — shooting client detects hits locally, sends hit events to server, server validates + applies damage + broadcasts to all.

Step 1: Backend Contracts & Constants
1a. backend/Velocity.Api/Configuration/WebSocketSettings.cs
Add combat constants:
csharppublic const int MaxPlayerHealth = 100;
public const int RespawnDelayMs = 3000;
public const float MaxHitDistance = 600f;
public const int MinFireIntervalMs = 50;
public const int MaxDamagePerHit = 500;
1b. New file: backend/Velocity.Api/Contracts/CombatContracts.cs
csharppublic static class CombatMessageTypes
{
    public const string Hit = "hit";
    public const string PlayerDamaged = "player_damaged";
    public const string PlayerKilled = "player_killed";
    public const string PlayerRespawned = "player_respawned";
}

public static class HitboxZones
{
    public const string Head = "head";
    public const string Torso = "torso";
    public const string Limb = "limb";
}

Step 2: Server-side Health & Hit Handling
2a. backend/Velocity.Api/Services/Multiplayer/PlayerSocket.cs
Add properties:

int Health (default MaxPlayerHealth)
bool IsDead
long LastHitEventAt (rate limit)
int Kills, int Deaths

2b. backend/Velocity.Api/Services/Multiplayer/Room.cs
Add case in ProcessJsonMessage switch:
csharpcase CombatMessageTypes.Hit:
    await HandleHit(slot, root, ct);
    break;
Add HandleHit method — parses { targetPlayerId, weapon, zone, damage, distance }:

Sanity: shooter alive, target alive, not self, distance < MaxHitDistance, damage capped, fire rate limit
Apply damage: target.Health -= ceil(min(damage, target.Health))
If dead: set IsDead=true, increment kills/deaths
Broadcast player_damaged with: targetPlayerId, attackerPlayerId, attackerName, damage, healthRemaining, weapon, zone, isHeadshot
If dead: broadcast player_killed + schedule respawn after RespawnDelayMs

Add FindPlayerById(Guid) helper (iterate _players under _playerLock)
Add ScheduleRespawn method — Task.Delay then reset Health + IsDead, broadcast player_respawned
2c. Reset combat state in RunCountdownSequence
Reset Health, IsDead, Kills, Deaths for all players when race starts.
2d. Include health in room snapshot (GetFullSnapshot)
Add health, isDead, kills, deaths to per-player snapshot data for rejoin support.

Step 3: Remote Player Hitboxes (Frontend)
3a. frontend/src/game/components/game/physics/constants.ts
Add hitbox dimension constants:
typescriptREMOTE_HITBOX_RADIUS: 0.35,
REMOTE_HITBOX_HALF_HEIGHT: 0.5,
REMOTE_HEAD_RADIUS: 0.25,
REMOTE_HEAD_Y_OFFSET: 0.85,
3b. New file: frontend/src/game/components/game/RemotePlayerHitbox.tsx

Creates a Rapier kinematic rigid body with sensor colliders per remote player
Torso: CapsuleCollider (sensor) → registered in hitboxRegistry with zone='torso', entityId=playerId
Head: BallCollider (sensor) → registered with zone='head', entityId=playerId
useFrame: rbRef.setNextKinematicTranslation(interpolated position)
Cleanup: unregisterEntity(playerId) on unmount
Max ~60 lines

3c. frontend/src/game/components/game/RemotePlayers.tsx
For each remote player, render <RemotePlayerHitbox> alongside the visual model:
tsx<RemotePlayerHitbox key={`hb-${p.id}`} playerId={p.id} position={p.snapshot.position} />

Step 4: Frontend — Sending Hit Events
4a. frontend/src/game/stores/multiplayerStore.ts
Add sendHit action:
typescriptsendHit: (targetPlayerId: string, weapon: string, zone: string, damage: number, distance: number) => void;
Implementation: transport.sendJson('hit', { targetPlayerId, weapon, zone, damage, distance })
4b. frontend/src/game/components/game/physics/weaponFire.ts
Modify processHitscanHit:

After resolving hitbox, check if entityId is a remote player (UUID format, 36 chars) vs local dummy
Remote player: call sendHit(entityId, weapon, zone, finalDamage, distance) + pushHitMarker(false, isHeadshot) — no registerKill (server decides)
Local dummy: keep existing behavior (immediate registerKill)

Add isRemotePlayerEntity(entityId: string): boolean helper.
4c. frontend/src/game/components/game/physics/projectileTick.ts
After rocket/grenade explosion, check for remote player colliders within blast radius:

Use rapierWorld.intersectionsWithShape() with a sphere at explosion point
For each intersected collider: resolveHitbox() → if remote player, calculate distance-based damage falloff → sendHit()
Deduplicate by entityId (same player hit by multiple colliders = single hit)


Step 5: Frontend — Receiving Damage/Kill/Respawn Events
5a. frontend/src/game/stores/multiplayerStore.ts
Add state: remoteHealth: Map<string, { health: number; isDead: boolean }>
Register JSON handlers in connectToMatch:
player_damaged handler:

Update remoteHealth map
If target is local player: sync combatStore health from server-authoritative value
If attacker is local player: pushHitMarker + hit sound confirmation

player_killed handler:

Update remoteHealth (isDead=true)
If killer is local player: combat.registerKill() + kill confirm hitmarker
If victim is local player: trigger death screen/fade

player_respawned handler:

Update remoteHealth (health=100, isDead=false)
If local player: reset combatStore health, teleport to spawn

5b. Populate remoteHealth from room_snapshot handler
Read health/isDead from enriched snapshot data on rejoin.
5c. Reset remoteHealth in disconnectFromMatch and resetMultiplayer

File Summary
FileActionbackend/.../WebSocketSettings.csAdd combat constantsbackend/.../Contracts/CombatContracts.csNew — message types, hitbox zonesbackend/.../PlayerSocket.csAdd Health, IsDead, Kills, Deathsbackend/.../Room.csAdd HandleHit, FindPlayerById, ScheduleRespawn, combat resetfrontend/.../physics/constants.tsAdd remote hitbox dimensionsfrontend/.../RemotePlayerHitbox.tsxNew — kinematic sensor colliders for remote playersfrontend/.../RemotePlayers.tsxWire in RemotePlayerHitbox per playerfrontend/.../multiplayerStore.tsAdd sendHit, remoteHealth, damage/kill/respawn handlersfrontend/.../physics/weaponFire.tsBranch remote vs dummy in processHitscanHitfrontend/.../physics/projectileTick.tsAdd splash damage to remote players

Verification

dotnet build Velocity.slnx — backend compiles
cd frontend && npx tsc --noEmit — frontend type-checks
Manual test: Two browsers → Play as Guest → Create Room → Join → Start Race

Hitscan: Shoot other player with sniper → confirm hitmarker + devLog shows "player_damaged"
Rocket: Fire at other player → splash damage applied
Health: Target health decreases, server broadcasts correct healthRemaining
Kill: Reduce to 0 → "player_killed" broadcast, respawn after 3s
Rejoin: Disconnect/reconnect → health restored from snapshot