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
- ✅ Add `MaxPlayerHealth = 100`, `RespawnDelayMs = 3000`, `MaxHitDistance = 600f`, `MinFireIntervalMs = 50`, `MaxDamagePerHit = 500`

### 1.2 Combat Contracts
`backend/Velocity.Api/Contracts/CombatContracts.cs` *(new)*
- ✅ `CombatMessageTypes` — `Hit`, `PlayerDamaged`, `PlayerKilled`, `PlayerRespawned`
- ✅ `HitboxZones` — `Head`, `Torso`, `Limb`

### 1.3 Player Combat State
`backend/Velocity.Api/Services/Multiplayer/PlayerSocket.cs`
- ✅ Add `Health`, `IsDead`, `LastHitEventAt`, `Kills`, `Deaths`

### 1.4 Server Hit Handling
`backend/Velocity.Api/Services/Multiplayer/Room.cs`
- ✅ `HandleHit` — parse `{ targetPlayerId, weapon, zone, damage, distance }`, validate (alive, not self, distance, rate limit, cap damage), apply damage, broadcast `player_damaged`
- ✅ If kill → broadcast `player_killed`, schedule respawn
- ✅ `FindPlayerById(Guid)` helper
- ✅ `ScheduleRespawn` — `Task.Delay` → reset health/isDead, broadcast `player_respawned`
- ✅ Wire `"hit"` case in `ProcessJsonMessage`

### 1.5 Combat Reset & Snapshot
`backend/Velocity.Api/Services/Multiplayer/Room.cs`
- ✅ Reset `Health`, `IsDead`, `Kills`, `Deaths` in `RunCountdownSequence`
- ✅ Include `health`, `isDead`, `kills`, `deaths` per player in `GetFullSnapshot`

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

---
---

# Plan — NPC Bot (Ollama-Driven)

## Context

Multiplayer exists with binary position protocol (20Hz broadcast), JSON control channel,
REST room management, and guest auth (`POST /api/auth/guest` → JWT).

**Goal:** A standalone Node.js process that connects to a room as a normal player,
receives game state, queries a local Ollama model for movement decisions, and sends
binary position updates — appearing as a real player to everyone else.

**Approach:** Two-layer AI — Ollama decides *strategy* (~2-5 Hz), a deterministic
movement loop executes *tactics* (20 Hz position ticks). Keeps it responsive even
with LLM latency.

---

## Phase 1 — Bot Client Skeleton

### 1.1 Project Setup
`bot/` *(new directory at repo root)*
- 🔲 `package.json` — name: `velocity-bot`, type: module, deps: `ws`, `undici` (fetch)
- 🔲 `tsconfig.json` — strict, ESNext, NodeNext
- 🔲 `src/main.ts` — entry point, CLI args: `--server`, `--room`, `--model`

### 1.2 Auth Client
`bot/src/api.ts` *(new)*
- 🔲 `authenticateAsGuest(serverUrl)` → `POST /api/auth/guest` → returns `{ token, playerId, username }`
- 🔲 `joinRoom(serverUrl, roomId, token)` → `POST /api/rooms/{id}/join`
- 🔲 `setReady(serverUrl, roomId, token)` → `POST /api/rooms/{id}/ready`

### 1.3 WebSocket Transport
`bot/src/transport.ts` *(new)*
- 🔲 Connect to `ws://server/ws/multiplayer/{roomId}?token={jwt}`
- 🔲 Parse incoming binary messages (position batch: `0x02` header)
- 🔲 Parse incoming JSON messages (`room_snapshot`, `countdown`, `match_start`, `player_joined`, `player_left`, `match_finished`)
- 🔲 `sendPosition(x, y, z, yaw, pitch, speed, checkpoint)` — encode binary (20 bytes, same protocol as frontend `PositionCodec`)
- 🔲 `sendJson(type, payload)` — for ping/pong keepalive
- 🔲 Ping loop (5s interval) to stay alive

### 1.4 Position Codec (Node)
`bot/src/codec.ts` *(new)*
- 🔲 `encodePosition(x, y, z, yaw, pitch, speed, checkpoint)` → `Buffer` (20 bytes)
  - yaw/pitch: radians × 10000 → int16 LE
  - speed: u/s × 10 → uint16 LE
  - positions: float32 LE
- 🔲 `decodeBatch(buffer)` → `Array<{ slot, x, y, z, yaw, pitch, speed, checkpoint }>`

---

## Phase 2 — Game State Tracker

### 2.1 World State
`bot/src/state.ts` *(new)*
- 🔲 `BotState` — own position `{x,y,z}`, yaw, pitch, speed, checkpoint, health, isDead
- 🔲 `PlayerState[]` — tracked from position batch: slot → `{x,y,z, yaw, pitch, speed}`
- 🔲 `MatchState` — status (`lobby`|`countdown`|`racing`|`finished`), matchStartTime, mySlot
- 🔲 Update from `room_snapshot`, `match_start`, position batches, combat events

### 2.2 Map Awareness (Minimal)
`bot/src/state.ts`
- 🔲 Checkpoint list: hardcoded positions for the active map (start with one map)
- 🔲 `nextCheckpoint()` → world position of next target
- 🔲 `distanceTo(target)` → float

---

## Phase 3 — Ollama Integration

### 3.1 Ollama Client
`bot/src/ollama.ts` *(new)*
- 🔲 `queryOllama(model, prompt)` → `POST http://localhost:11434/api/generate` with `{ model, prompt, stream: false }`
- 🔲 Parse response `.response` field
- 🔲 Timeout: 2s max, fallback to last decision on timeout
- 🔲 Rate limit: max 1 query per 500ms (configurable)

### 3.2 Decision Prompt
`bot/src/brain.ts` *(new)*
- 🔲 Build compact JSON prompt from game state:
  ```
  You are an NPC in a 3D speedrun game. Respond with JSON only.
  State: { pos: [x,y,z], speed, yaw, checkpoint, nextTarget: [x,y,z],
           nearbyPlayers: [{dir, dist}], health, matchTime }
  Respond: { "action": "move"|"jump"|"strafe_left"|"strafe_right"|"stop",
             "turnToward": [x,y,z] | null,
             "shouldJump": bool }
  ```
- 🔲 Parse LLM response as JSON, with fallback `{ action: "move", turnToward: nextCheckpoint, shouldJump: false }`
- 🔲 Sanitize: clamp values, reject garbage

### 3.3 Decision Loop
`bot/src/brain.ts`
- 🔲 `startBrain(state, ollama)` — `setInterval` at configurable Hz (default 2 Hz)
- 🔲 Each tick: build prompt → query Ollama → store latest decision
- 🔲 Expose `getLatestDecision()` for movement loop to consume

---

## Phase 4 — Movement Execution

### 4.1 Movement Loop
`bot/src/movement.ts` *(new)*
- 🔲 Run at 20 Hz (matches server broadcast rate — no need for 128 Hz without physics sim)
- 🔲 Each tick:
  1. Read latest decision from brain
  2. Calculate desired direction from `turnToward` target
  3. Smooth yaw rotation toward target (max turn rate/tick)
  4. Apply forward movement in yaw direction at `GROUND_MAX_SPEED` (400 u/s)
  5. If `shouldJump` → apply simple ballistic arc (gravity 1000 u/s², jump force 350 u/s)
  6. Update `BotState` position
  7. Send binary position update via transport

### 4.2 Simple Physics
`bot/src/movement.ts`
- 🔲 Gravity: `vy -= 1000 * dt`, clamp y to ground plane (y=0 or map floor)
- 🔲 Speed: constant `400 u/s` forward when moving, `0` when stopped
- 🔲 No collision detection (bot will clip through walls — good enough for v1)
- 🔲 Strafe: offset movement direction ±90° from yaw

---

## Phase 5 — Lifecycle & Polish

### 5.1 Match Lifecycle
`bot/src/main.ts`
- 🔲 On `match_start` → start brain + movement loops
- 🔲 On `match_finished` → stop loops, log results
- 🔲 On disconnect → attempt reconnect (3 tries, 2s backoff)
- 🔲 On `countdown` → log countdown state
- 🔲 Graceful shutdown on SIGINT

### 5.2 Configuration
`bot/src/config.ts` *(new)*
- 🔲 `BOT_CONFIG as const`:
  - `serverUrl` (default `https://localhost:5001`)
  - `ollamaUrl` (default `http://localhost:11434`)
  - `ollamaModel` (default `llama3.2`)
  - `decisionHz` (default `2`)
  - `movementHz` (default `20`)
  - `maxSpeed` (default `400`)
  - `jumpForce` (default `350`)
  - `gravity` (default `1000`)
- 🔲 Override from CLI args or env vars

### 5.3 Logging
`bot/src/main.ts`
- 🔲 Structured console logging: `[BOT] [BRAIN] decided: move toward checkpoint 2`
- 🔲 Log Ollama latency per query
- 🔲 Log position updates at 1 Hz (not every tick)

---

## Verification

```bash
# 1. Start Ollama with a model
ollama run llama3.2

# 2. Start Velocity backend
cd backend/Velocity.Api && dotnet run --launch-profile https

# 3. Start frontend
cd frontend && npm run dev

# 4. Create a room in browser, note room ID

# 5. Run bot
cd bot && npx tsx src/main.ts --server https://localhost:5001 --room <room-id> --model llama3.2
```

Manual test:
- Bot appears as player in room (visible in lobby player list)
- Host starts match → bot begins moving
- Bot moves toward checkpoints, changes direction based on Ollama decisions
- Bot visible as remote player model in other clients
- Ollama query latency logged (~200-500ms)
- Bot handles match finish gracefully
