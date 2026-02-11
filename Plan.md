# Plan — Multiplayer Combat (Client-Authoritative)

## Context

Multiplayer works for position sync and race lifecycle. Combat damage is purely local —
remote players have no physics colliders, no network hit protocol, and no server-side health.

**Approach:** Client-authoritative — shooting client detects hits locally, sends hit events
to server, server validates + applies damage + broadcasts to all.

---

## Phase 1 — Backend Combat Foundation

### 1.1 Combat Constants
`backend/Velocity.Api/Configuration/WebSocketSettings.cs`
- 🔲 Add `MaxPlayerHealth = 100`, `RespawnDelayMs = 3000`, `MaxHitDistance = 600f`, `MinFireIntervalMs = 50`, `MaxDamagePerHit = 500`

### 1.2 Combat Contracts
`backend/Velocity.Api/Contracts/CombatContracts.cs` *(new)*
- 🔲 `CombatMessageTypes` — `Hit`, `PlayerDamaged`, `PlayerKilled`, `PlayerRespawned`
- 🔲 `HitboxZones` — `Head`, `Torso`, `Limb`

### 1.3 Player Combat State
`backend/Velocity.Api/Services/Multiplayer/PlayerSocket.cs`
- 🔲 Add `Health`, `IsDead`, `LastHitEventAt`, `Kills`, `Deaths`

### 1.4 Server Hit Handling
`backend/Velocity.Api/Services/Multiplayer/Room.cs`
- 🔲 `HandleHit` — parse `{ targetPlayerId, weapon, zone, damage, distance }`, validate (alive, not self, distance, rate limit, cap damage), apply damage, broadcast `player_damaged`
- 🔲 If kill → broadcast `player_killed`, schedule respawn
- 🔲 `FindPlayerById(Guid)` helper
- 🔲 `ScheduleRespawn` — `Task.Delay` → reset health/isDead, broadcast `player_respawned`
- 🔲 Wire `"hit"` case in `ProcessJsonMessage`

### 1.5 Combat Reset & Snapshot
`backend/Velocity.Api/Services/Multiplayer/Room.cs`
- 🔲 Reset `Health`, `IsDead`, `Kills`, `Deaths` in `RunCountdownSequence`
- 🔲 Include `health`, `isDead`, `kills`, `deaths` per player in `GetFullSnapshot`

---

## Phase 2 — Remote Player Hitboxes (Frontend)

### 2.1 Hitbox Constants
`frontend/src/game/components/game/physics/constants.ts`
- 🔲 Add `REMOTE_HITBOX_RADIUS`, `REMOTE_HITBOX_HALF_HEIGHT`, `REMOTE_HEAD_RADIUS`, `REMOTE_HEAD_Y_OFFSET`

### 2.2 RemotePlayerHitbox Component
`frontend/src/game/components/game/RemotePlayerHitbox.tsx` *(new)*
- 🔲 Kinematic rigid body with sensor colliders (torso capsule + head sphere)
- 🔲 Register in `hitboxRegistry` with `zone` and `entityId=playerId`
- 🔲 `useFrame` → `setNextKinematicTranslation(interpolated position)`
- 🔲 Cleanup: `unregisterEntity` on unmount

### 2.3 Wire into RemotePlayers
`frontend/src/game/components/game/RemotePlayers.tsx`
- 🔲 Render `<RemotePlayerHitbox>` per remote player alongside visual model

---

## Phase 3 — Sending Hit Events (Frontend)

### 3.1 sendHit Action
`frontend/src/game/stores/multiplayerStore.ts`
- 🔲 `sendHit(targetPlayerId, weapon, zone, damage, distance)` → `transport.sendJson('hit', ...)`

### 3.2 Hitscan → Remote Players
`frontend/src/game/components/game/physics/weaponFire.ts`
- 🔲 `isRemotePlayerEntity(entityId)` helper
- 🔲 In `processHitscanHit`: branch remote (sendHit + hitMarker, no local kill) vs dummy (keep existing)

### 3.3 Splash Damage → Remote Players
`frontend/src/game/components/game/physics/projectileTick.ts`
- 🔲 On explosion: `intersectionsWithShape` → resolve remote colliders → distance falloff → `sendHit`
- 🔲 Deduplicate by entityId

---

## Phase 4 — Receiving Combat Events (Frontend)

### 4.1 Remote Health State
`frontend/src/game/stores/multiplayerStore.ts`
- 🔲 `remoteHealth: Map<string, { health: number; isDead: boolean }>`

### 4.2 Combat Event Handlers
`frontend/src/game/stores/multiplayerStore.ts`
- 🔲 `player_damaged` → update remoteHealth; if local target → sync combatStore health; if local attacker → hitMarker + sound
- 🔲 `player_killed` → update remoteHealth; if local killer → registerKill + hitMarker; if local victim → death screen
- 🔲 `player_respawned` → update remoteHealth; if local → reset health, teleport to spawn

### 4.3 Snapshot & Cleanup
`frontend/src/game/stores/multiplayerStore.ts`
- 🔲 Populate `remoteHealth` from `room_snapshot`
- 🔲 Clear `remoteHealth` in `disconnectFromMatch` and `resetMultiplayer`

---

## Verification

```bash
dotnet build Velocity.slnx
cd frontend && npx tsc --noEmit && npx vite build
```

Manual: Two browsers → Play as Guest → Create Room → Join → Start Race →
- Hitscan: shoot other player → hitmarker + `player_damaged` in devLog
- Rocket: splash damage applied to remote player
- Health: target health decreases, server broadcasts correct `healthRemaining`
- Kill: reduce to 0 → `player_killed`, respawn after 3s
- Rejoin: disconnect/reconnect → health restored from snapshot
