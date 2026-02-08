# Velocity Engine — Technical Reference

> Generic, reusable game engine extracted from the Velocity speedrunning game.
> One-way dependency: game code imports engine — engine NEVER imports game code.

## Stack

| Layer | Technology |
|-------|-----------|
| Renderer | Three.js WebGPU (`three/webgpu`) + React Three Fiber v9 |
| Shading | TSL (Three Shading Language) — compute shaders, post-processing |
| Physics | Rapier (`@dimforge/rapier3d-compat`) — KinematicCharacterController |
| State | Zustand (minimal stores for audio, effects, dev tools) |
| Audio | Web Audio API (oscillator synth, replaceable with samples) |
| UI | React 19 + Tailwind CSS v4 |

## Directory Layout

```
frontend/src/engine/
  core/            ← WebGPU init, post-processing pipeline
  physics/         ← Movement math, constants, advanced mechanics
  input/           ← Input buffer (keyboard + mouse + pointer lock)
  audio/           ← AudioManager (Web Audio synth engine)
  effects/         ← GPU particles, explosions, screen shake
  stores/          ← Dev log, perf monitor, debug panel
  types/           ← InputState, MovementState, map data types
  rendering/       ← (reserved) instancing, model rendering
  hud/             ← (reserved) generic HUD components
  index.ts         ← Barrel re-export of all modules
```

---

## Module Reference

---

### 1. Core (`engine/core/`)

#### `setup-webgpu.ts` — Side-effect module (import once at app entry)

**Must be imported before any R3F `<Canvas>`.** Performs two critical initializations:

1. **`extend(THREE)`** from `three/webgpu` — registers WebGPU node classes with R3F's catalogue
2. **`RAPIER.init({})`** — pre-initializes Rapier WASM (prevents deprecated positional init from @react-three/rapier)

```typescript
// main.tsx — import FIRST
import './engine/core/setup-webgpu';
```

#### `PostProcessingEffects` — React component

Renders the full post-processing pipeline using Three.js native `PostProcessing` class + TSL nodes. **Disables R3F auto-render** (renderPriority=1).

**Pipeline:** Scene → Bloom → Vignette → ACES Tonemapping → sRGB

| Constant | Value | Purpose |
|----------|-------|---------|
| `BLOOM_THRESHOLD` | 0.8 | Luminance cutoff |
| `BLOOM_STRENGTH` | 0.4 | Bloom intensity |
| `BLOOM_RADIUS` | 0.3 | Bloom spread |
| `VIGNETTE_INTENSITY` | 1.2 | Edge darkening |
| `VIGNETTE_SOFTNESS` | 0.5 | Falloff curve |

```tsx
// Inside your scene, after all 3D objects:
<PostProcessingEffects />
```

**Dependencies:** `three/webgpu` (WebGPURenderer, PostProcessing), `three/addons/tsl/display/BloomNode.js` (bloom), TSL nodes (viewportUV, pass, renderOutput).

---

### 2. Physics (`engine/physics/`)

The physics system implements **Quake/Source-style movement** at a **128Hz fixed timestep**. All velocity is in **units per second**. Gravity and acceleration are applied manually — Rapier gravity must be `[0, 0, 0]`.

#### `ENGINE_PHYSICS` — Constants object

```typescript
import { ENGINE_PHYSICS } from 'engine/physics';
```

##### Timing
| Key | Value | Notes |
|-----|-------|-------|
| `TICK_RATE` | 128 | Fixed physics timestep |
| `TICK_DELTA` | 0.0078125 | 1/128 seconds |

##### Ground Movement
| Key | Value | Notes |
|-----|-------|-------|
| `GROUND_ACCEL` | 15 | Acceleration multiplier |
| `GROUND_DECEL` | 10 | Deceleration on counter-strafe |
| `GROUND_MAX_SPEED` | 320 | Max ground speed (u/s) |
| `GROUND_FRICTION` | 6.0 | Friction factor |
| `STOP_SPEED` | 100 | Below this, friction uses STOP_SPEED as control |

##### Air Movement
| Key | Value | Notes |
|-----|-------|-------|
| `AIR_ACCEL` | 12 | Air acceleration multiplier |
| `AIR_SPEED_CAP` | 30 | Per-tick wish speed cap (NOT total velocity cap) |

**Critical:** There is NO global air velocity cap. Players build unlimited speed via air strafing. The `AIR_SPEED_CAP` only limits per-tick acceleration projection — this is what enables the Quake bunny-hop speedbuilding mechanic.

##### Jumping
| Key | Value | Notes |
|-----|-------|-------|
| `JUMP_FORCE` | 150 | Full jump velocity (u/s) |
| `JUMP_FORCE_MIN` | 80 | Tap-jump minimum |
| `JUMP_BUFFER_MS` | 80 | Pre-land input buffer |
| `JUMP_RELEASE_WINDOW_MS` | 100 | Early release cuts velocity |
| `COYOTE_TIME_MS` | 100 | Grace period after leaving ground |
| `GRAVITY` | 800 | Base gravity (u/s²) |
| `GRAVITY_JUMP_RELEASE` | 1400 | Gravity when jump released early |

Jump peak height formula: `peak = v² / (2 * g)`. With JUMP_FORCE=150, GRAVITY=800 → peak ≈ 14.06 units.

##### Player Capsule
| Key | Value | Notes |
|-----|-------|-------|
| `PLAYER_RADIUS` | 0.4 | Capsule radius |
| `PLAYER_HEIGHT` | 1.8 | Standing height |
| `PLAYER_HEIGHT_CROUCH` | 1.0 | Crouching height |
| `PLAYER_EYE_OFFSET` | 0.75 | Eye above capsule center |
| `PLAYER_EYE_OFFSET_CROUCH` | 0.2 | Eye offset when crouching |

##### Crouch Sliding
| Key | Value | Notes |
|-----|-------|-------|
| `CROUCH_FRICTION` | 1.2 | Reduced friction while sliding |
| `CROUCH_SLIDE_MIN_SPEED` | 150 | Minimum speed to enter slide |
| `CROUCH_SLIDE_BOOST` | 60 | Instant speed bonus on slide entry |

##### Collision
| Key | Value | Notes |
|-----|-------|-------|
| `STAIR_STEP_HEIGHT` | 0.45 | Auto-step threshold |
| `MAX_SLOPE_ANGLE` | 45 | Walkable slope limit (degrees) |
| `SKIN_WIDTH` | 0.05 | Character controller offset |
| `MAX_SPEED` | 2500 | Hard velocity clamp |
| `MAX_DISPLACEMENT_PER_STEP` | 2 | Max move per physics step |

##### Wall Running
| Key | Value | Notes |
|-----|-------|-------|
| `WALL_RUN_MIN_SPEED` | 200 | Entry speed threshold |
| `WALL_RUN_MAX_DURATION` | 1.5 | Max time on wall (seconds) |
| `WALL_RUN_SPEED_PRESERVATION` | 0.9 | Retain 90% of entry speed |
| `WALL_RUN_GRAVITY_MULT` | 0.15 | 15% normal gravity on wall |
| `WALL_RUN_JUMP_FORCE_NORMAL` | 250 | Push away from wall |
| `WALL_RUN_JUMP_FORCE_UP` | 200 | Upward boost on wall jump |
| `WALL_RUN_DETECTION_DIST` | 0.8 | Raycast distance for wall |
| `WALL_RUN_MIN_HEIGHT` | 1.0 | Min height above ground |

##### Surfing
| Key | Value | Notes |
|-----|-------|-------|
| `SURF_MIN_ANGLE` | 30 | Minimum surface angle (degrees) |
| `SURF_MAX_ANGLE` | 60 | Maximum surface angle (degrees) |
| `SURF_FRICTION` | 0 | Zero friction on surf ramps |

##### Zone Mechanics
| Key | Value | Notes |
|-----|-------|-------|
| `BOOST_PAD_DEFAULT_SPEED` | 400 | Additive velocity (u/s) |
| `LAUNCH_PAD_DEFAULT_SPEED` | 600 | Replacement velocity (u/s) |
| `SPEED_GATE_MULTIPLIER` | 1.5 | Horizontal speed multiplier |
| `SPEED_GATE_MIN_SPEED` | 400 | Activation threshold (u/s) |

##### Grappling Hook
| Key | Value | Notes |
|-----|-------|-------|
| `GRAPPLE_SPEED` | 1200 | Hook projectile speed (u/s) |
| `GRAPPLE_MAX_DISTANCE` | 80 | Max grapple range (units) |
| `GRAPPLE_PULL_FORCE` | 1500 | Pull acceleration (u/s²) |
| `GRAPPLE_SWING_GRAVITY` | 600 | Reduced gravity while swinging |
| `GRAPPLE_RELEASE_BOOST` | 1.15 | Speed multiplier on release |

##### Mouse
| Key | Value |
|-----|-------|
| `DEFAULT_SENSITIVITY` | 0.002 |

##### Utility Constants
| Name | Value |
|------|-------|
| `DEG2RAD` | `Math.PI / 180` |
| `RAD2DEG` | `180 / Math.PI` |

---

#### Movement Functions (`useMovement.ts`)

All functions mutate a `Vector3` velocity in-place. `dt` = delta time in seconds (typically `TICK_DELTA`).

##### `getWishDir(forward, backward, left, right, yaw) → Vector3`
Converts boolean WASD input + yaw angle (radians) into a normalized world-space direction vector. Returns zero vector if no input.

```typescript
const wishDir = getWishDir(input.forward, input.backward, input.left, input.right, yaw);
```

##### `applyFriction(velocity, dt, hasInput?, wishDir?)`
Ground friction with counter-strafe detection. If input opposes current velocity (dot product < -0.5), uses `GROUND_FRICTION + GROUND_DECEL` for snappy direction changes.

Formula: `drop = control * friction * dt`, where `control = max(speed, STOP_SPEED)`.

##### `applySlideFriction(velocity, dt)`
Same as `applyFriction` but uses `CROUCH_FRICTION` (1.2) instead of `GROUND_FRICTION` (6.0).

##### `applyGroundAcceleration(velocity, wishDir, dt, speedMult?)`
Quake-style ground acceleration. Projects current velocity onto wish direction, accelerates up to `GROUND_MAX_SPEED * speedMult`.

```
currentSpeed = velocity · wishDir
addSpeed = wishSpeed - currentSpeed
accelSpeed = min(addSpeed, GROUND_ACCEL * wishSpeed * dt)
velocity += accelSpeed * wishDir
```

##### `applyAirAcceleration(velocity, wishDir, dt, speedMult?)`
Air strafing — the core speed-building mechanic. Identical to ground acceleration but `wishSpeed` is capped at `AIR_SPEED_CAP * speedMult`. The per-tick cap allows skilled players to build unlimited speed via precise mouse movement + strafe keys.

##### `getHorizontalSpeed(velocity) → number`
Returns `sqrt(x² + z²)` — horizontal speed ignoring vertical component.

---

#### Advanced Movement Functions (`useAdvancedMovement.ts`)

##### Wall Running

```typescript
interface WallRunState {
  isWallRunning: boolean;
  wallRunTime: number;
  wallNormal: [number, number, number];
  lastWallNormalX: number;
  lastWallNormalZ: number;
  wallRunCooldown: boolean;
}

createWallRunState() → WallRunState  // factory with defaults

updateWallRun(state, velocity, isGrounded, strafeLeft, strafeRight,
              hasWallLeft, hasWallRight, wallNormalX, wallNormalZ, dt) → boolean
// Returns true if wall running. Handles entry, duration, gravity, exit.

wallJump(state, velocity) → void
// Pushes away from wall (250 u/s normal) + upward (200 u/s). Sets cooldown.
```

**Activation:** Not grounded + speed ≥ 200 + strafing toward wall + not on cooldown + different wall than last run.
**During run:** 90% speed preserved, 15% normal gravity, max 1.5s duration.
**Cooldown:** Must touch ground before running the same wall again.

##### Surfing

```typescript
isSurfSurface(normalX, normalY, normalZ) → boolean
// True if surface angle is 30-60 degrees from vertical

applySurfPhysics(velocity, normalX, normalY, normalZ, dt) → void
// Zero-friction sliding: projects gravity along surface, keeps player on surface
```

##### Grapple

```typescript
applyGrappleSwing(velocity, playerPos, grappleTarget, grappleLength, dt) → void
// Pendulum physics: pull toward target (1500 u/s²), reduced gravity (600),
// constrain to rope length
```

##### Explosion Knockback

```typescript
applyExplosionKnockback(velocity, playerPos, explosionPos, radius, force, baseDamage) → number
// Directional knockback with distance falloff: falloff = 1 - dist/radius
// Returns: baseDamage * falloff (0 if out of range)
```

The game layer computes `baseDamage` from its own constants (e.g., `ROCKET_DAMAGE * SELF_DAMAGE_MULT` for self-hits). The engine only applies physics.

##### Zone Mechanics

```typescript
applyBoostPad(velocity, direction, speed) → void
// ADDITIVE: velocity += direction * speed

applyLaunchPad(velocity, direction, speed) → void
// REPLACEMENT: velocity = direction * speed

applySpeedGate(velocity, multiplier, minSpeed) → boolean
// Multiplies horizontal velocity if speed ≥ minSpeed. Returns true if activated.
```

---

### 3. Input (`engine/input/`)

#### `useInputBuffer()` — React hook

Returns `{ inputRef, consumeMouseDelta }`. Attaches keyboard, mouse, and wheel listeners to `window`. Only captures mouse input when pointer lock is active.

```typescript
const { inputRef, consumeMouseDelta } = useInputBuffer();

// In physics tick:
const input = inputRef.current;
const { dx, dy } = consumeMouseDelta(); // resets accumulators
```

**InputState fields:**

| Field | Type | Source |
|-------|------|--------|
| `forward` | boolean | W key |
| `backward` | boolean | S key |
| `left` | boolean | A key |
| `right` | boolean | D key |
| `jump` | boolean | Space |
| `crouch` | boolean | Shift / Ctrl |
| `fire` | boolean | Mouse button 0 |
| `altFire` | boolean | Mouse button 2 |
| `grapple` | boolean | E key |
| `reload` | boolean | R key |
| `mouseDeltaX` | number | Accumulated movementX |
| `mouseDeltaY` | number | Accumulated movementY |
| `weaponSlot` | number | Digit1-7 → 1-7, 0 = none |
| `scrollDelta` | number | Accumulated wheel deltaY |

**Default key bindings:** `W/S/A/D` movement, `Space` jump, `Shift/Ctrl` crouch, `E` grapple, `G` altFire, `R` reload, `1-7` weapon slots.

The hook reads custom bindings from `settingsStore` if available, falling back to defaults.

---

### 4. Audio (`engine/audio/`)

#### `audioManager` — Singleton

Web Audio API synth engine. Each sound is generated via oscillators (sine, square, sawtooth, triangle) with gain envelopes and optional low-pass filters. Designed to be replaceable with sample-based playback.

```typescript
import { audioManager, SOUNDS } from 'engine/audio';

audioManager.play(SOUNDS.ROCKET_FIRE);
audioManager.play(SOUNDS.FOOTSTEP_STONE, 0.15); // with pitch variation
audioManager.playFootstep('metal');               // surface-aware
```

**`play(soundId, pitchVariation?)`**
- Reads volume levels from `settingsStore` (masterVolume, sfxVolume, musicVolume, ambientVolume)
- Creates oscillator → optional filter → gain envelope → masterGain → destination
- Pitch randomization: `freq * (1 + (random - 0.5) * pitchVariation * 2)`

**`playFootstep(surfaceMaterial?)`**
- `'metal'` → FOOTSTEP_METAL, `'glass'` → FOOTSTEP_GLASS, default → FOOTSTEP_STONE

**Sound IDs (`SOUNDS` constant):**

| Category | Sounds |
|----------|--------|
| Movement | `FOOTSTEP_STONE`, `FOOTSTEP_METAL`, `FOOTSTEP_GLASS`, `JUMP`, `LAND_SOFT`, `LAND_HARD`, `SLIDE`, `WALL_RUN` |
| Weapons | `ROCKET_FIRE`, `ROCKET_EXPLODE`, `GRENADE_THROW`, `GRENADE_BOUNCE`, `GRENADE_EXPLODE` |
| Grapple | `GRAPPLE_FIRE`, `GRAPPLE_ATTACH`, `GRAPPLE_RELEASE` |
| Zones | `BOOST_PAD`, `LAUNCH_PAD`, `SPEED_GATE`, `AMMO_PICKUP` |
| Gameplay | `CHECKPOINT`, `FINISH`, `COUNTDOWN_TICK`, `COUNTDOWN_GO` |
| UI | `UI_CLICK`, `UI_HOVER` |

**Volume control:** The audio manager reads `settingsStore.getState()` for `masterVolume`, `sfxVolume`, `musicVolume`, `ambientVolume`. All values 0-1. Category is determined from a lookup map (all current sounds map to `'sfx'`).

---

### 5. Effects (`engine/effects/`)

#### `GpuParticles` — React component

GPU-accelerated particle system using TSL compute shaders + `SpriteNodeMaterial`.

```tsx
<GpuParticles
  count={500}
  position={[0, 5, 0]}
  color="#ff6600"
  spread={2.0}        // optional, default 1.0
  speed={3.0}         // optional, default 2.0
  direction={[0,1,0]} // optional, default [0,1,0]
/>
```

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `count` | number | required | Particle count |
| `position` | `[x,y,z]` | required | Emitter position |
| `color` | string | required | Hex color `"#rrggbb"` |
| `spread` | number | 1.0 | Randomization radius |
| `speed` | number | 2.0 | Emission speed multiplier |
| `direction` | `[x,y,z]` | `[0,1,0]` | Emission direction |

**GPU pipeline:** Init compute shader randomizes positions/velocities → Update compute shader applies movement + life decay + respawn.

Sprite size: 0.15 units. Life range: 0.3–1.5 seconds. Additive blending, no depth write.

---

#### `ExplosionManager` + `useExplosionStore` — Component + Zustand store

Pre-pooled GPU explosion system. Spawn explosions from anywhere via the store.

```typescript
import { useExplosionStore } from 'engine/effects';

// Spawn an explosion:
useExplosionStore.getState().spawnExplosion([x, y, z], '#ff4400', 1.5);
```

```tsx
// In your scene (mount once):
<ExplosionManager />
```

**Store API:**
- `spawnExplosion(position, color, scale?)` — enqueue explosion request
- `consumeRequests()` — drain queue (called internally by ExplosionManager)

| Constant | Value | Purpose |
|----------|-------|---------|
| `PARTICLE_COUNT` | 96 | Particles per explosion |
| `SPRITE_SIZE` | 0.5 | Particle sprite size |
| `SPEED` | 14.0 | Burst emission speed |
| `LIFE` | 1.0 | Max particle lifetime (s) |
| `GRAVITY` | 6.0 | Downward pull on particles |
| `POOL_SIZE` | 6 | Max simultaneous explosions |

**GPU pipeline:** Spherical burst emission → gravity + drag decay → recycled in FIFO.

---

#### `ScreenShake` — React component

Prop-driven camera shake with exponential decay. No store dependency — the game layer passes its own shake source.

```tsx
<ScreenShake
  getIntensity={() => gameStore.getState().shakeIntensity}
  onDecayed={() => gameStore.getState().clearShake()}
/>
```

| Prop | Type | Purpose |
|------|------|---------|
| `getIntensity` | `() => number` | Polled every frame, 0–1 |
| `onDecayed` | `() => void` | Called when shake reaches zero |

| Constant | Value | Purpose |
|----------|-------|---------|
| `DECAY` | 8 | Exponential decay rate |
| `MAX_OFFSET` | 0.15 | Max camera displacement (units) |
| `FREQUENCY` | 25 | Oscillation frequency |

Applies sinusoidal offset to camera position. Decays via `lerp(intensity, 0, 1 - exp(-DECAY * dt))`.

---

### 6. Stores (`engine/stores/`)

#### `devLog` — Logging API + Zustand store

Ring-buffer log with 200 max entries. 5 log levels with convenience methods.

```typescript
import { devLog } from 'engine/stores';

devLog.info('Physics', 'Tick rate stable at 128Hz');
devLog.warn('Renderer', 'WebGPU fallback to WebGL2');
devLog.error('Audio', 'AudioContext suspended');
devLog.perf('Frame', `${fps.toFixed(0)} FPS`);
devLog.success('Init', 'Engine ready');
```

**Store state (`useDevLogStore`):**

| Field | Type | Purpose |
|-------|------|---------|
| `entries` | `LogEntry[]` | Ring buffer (max 200) |
| `visible` | boolean | Panel visibility toggle |
| `filter` | `string \| null` | Filter by source name |
| `perf` | `PerfMetrics` | FPS, frametime, memory, draw calls, etc. |
| `sources` | `string[]` | Unique source names |

**LogEntry:** `{ id, timestamp, level, source, message }`

**PerfMetrics:** `{ fps, frametime, frametimeMax, memoryMB, drawCalls, triangles, geometries, textures }`

#### `installErrorCapture()` — Call once at startup

Routes `window.onerror`, `window.onunhandledrejection`, and `console.warn/error` to the dev log.

```typescript
import { installErrorCapture } from 'engine/stores';
installErrorCapture(); // in main.tsx
```

#### `PerfMonitor` — React component

Invisible component that samples FPS/frametime/memory/renderer stats every 1 second and pushes to `devLogStore.perf`. Uses `useFrame` + `useThree` for renderer info.

```tsx
<PerfMonitor />
```

#### `DevLogPanel` — React component

Visual debug overlay (top-right). Shows perf metrics bar, filterable log entries, clear/close buttons. Toggled via `useDevLogStore.getState().toggle()`.

```tsx
{devLogVisible && <DevLogPanel />}
```

---

### 7. Types (`engine/types/`)

#### Physics Types

```typescript
interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  fire: boolean;
  altFire: boolean;
  grapple: boolean;
  reload: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
  weaponSlot: number;    // 0 = no switch, 1-7 = slot
  scrollDelta: number;
}

interface MovementState {
  velocity: Vector3;     // three.js Vector3
  isGrounded: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  yaw: number;           // radians
  pitch: number;         // radians
  jumpBufferTime: number;
}
```

#### Map Types

**Primitives:**
```typescript
type Vec3 = [number, number, number];
type Color = string; // hex "#rrggbb"
type BlockShape = 'box' | 'ramp' | 'cylinder' | 'wedge';
```

**Geometry:**
```typescript
interface MapBlock {
  shape: BlockShape;
  position: Vec3;
  size: Vec3;                         // [width, height, depth]
  rotation?: Vec3;                    // euler angles (radians)
  color: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  textureSet?: string;
  textureScale?: [number, number];    // UV repeat
}

interface MapModel {
  modelUrl: string;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  collider?: 'trimesh' | 'hull' | 'none';
}
```

**Zones:**
```typescript
interface CheckpointData   { position: Vec3; size: Vec3; index: number; }
interface FinishZoneData   { position: Vec3; size: Vec3; }
interface KillZoneData     { position: Vec3; size: Vec3; }
```

**Mechanics:**
```typescript
interface BoostPadData     { position: Vec3; direction: Vec3; speed?: number; size?: Vec3; color?: Color; }
interface LaunchPadData    { position: Vec3; direction: Vec3; speed?: number; size?: Vec3; color?: Color; }
interface SpeedGateData    { position: Vec3; size?: Vec3; multiplier?: number; minSpeed?: number; color?: Color; }
interface GrapplePointData { position: Vec3; }
interface SurfRampData     { position: Vec3; size: Vec3; rotation: Vec3; color?: Color; }
interface MovingPlatformData { size: Vec3; waypoints: Vec3[]; speed: number; color?: Color; pauseTime?: number; }
```

**Environment:**
```typescript
type ProceduralSkyboxType = 'day' | 'sunset' | 'night' | 'neon' | 'sky';
type SkyboxType = ProceduralSkyboxType | `hdri:${string}`;

interface AmbientLighting {
  ambientIntensity: number;
  ambientColor?: Color;
  directionalIntensity: number;
  directionalColor?: Color;
  directionalPosition?: Vec3;
  hemisphereGround?: Color;
  hemisphereSky?: Color;
  hemisphereIntensity?: number;
  fogColor?: Color;
  fogNear?: number;
  fogFar?: number;
}
```

---

## Integration Guide

### Minimal Setup

```tsx
// 1. main.tsx — import engine init FIRST
import './engine/core/setup-webgpu';
import { installErrorCapture } from './engine/stores/devLogStore';
installErrorCapture();

// 2. Scene component
import { PostProcessingEffects } from './engine/core';
import { PerfMonitor, DevLogPanel } from './engine/stores';
import { ExplosionManager } from './engine/effects';

function Scene() {
  return (
    <>
      {/* Your 3D objects here */}
      <ExplosionManager />
      <PerfMonitor />
      <PostProcessingEffects />
    </>
  );
}

// 3. HUD overlay (outside Canvas)
function HUD() {
  return <DevLogPanel />;
}
```

### Physics Integration Pattern

The engine provides pure movement math — your game layer owns the physics loop.

```typescript
import { ENGINE_PHYSICS } from './engine/physics/constants';
import {
  getWishDir, applyFriction, applyGroundAcceleration,
  applyAirAcceleration, getHorizontalSpeed,
} from './engine/physics/useMovement';
import { updateWallRun, wallJump, createWallRunState } from './engine/physics/useAdvancedMovement';
import { useInputBuffer } from './engine/input';

// In your physics tick (called at 128Hz):
function physicsTick(dt: number, input: InputState, state: MovementState) {
  const wishDir = getWishDir(input.forward, input.backward, input.left, input.right, state.yaw);

  if (state.isGrounded) {
    applyFriction(state.velocity, dt, hasInput, wishDir);
    applyGroundAcceleration(state.velocity, wishDir, dt);
  } else {
    applyAirAcceleration(state.velocity, wishDir, dt);
  }

  // Gravity (manual — Rapier gravity must be [0,0,0])
  state.velocity.y -= ENGINE_PHYSICS.GRAVITY * dt;

  // Jump
  if (input.jump && state.isGrounded) {
    state.velocity.y = ENGINE_PHYSICS.JUMP_FORCE;
  }

  // Move character controller with computed velocity * dt
}
```

### Extending Constants (Game Layer)

The game layer spreads `ENGINE_PHYSICS` and adds game-specific values:

```typescript
import { ENGINE_PHYSICS } from '../engine/physics/constants';

export const PHYSICS = {
  ...ENGINE_PHYSICS,
  // Game-specific additions:
  ROCKET_DAMAGE: 100,
  ROCKET_SELF_DAMAGE_MULT: 0.5,
  GRENADE_DAMAGE: 120,
  HEALTH_MAX: 200,
  HEALTH_REGEN_RATE: 15,
  // ... weapons, ammo, etc.
} as const;
```

### Extending Types (Game Layer)

Re-export engine types and add game-specific ones:

```typescript
// Re-export generic types for consumers
export type { InputState, MovementState } from '../engine/types/physics';

// Game-specific types
export type WeaponType = 'rocket' | 'grenade' | 'sniper' | 'assault' | 'shotgun' | 'knife' | 'plasma';

export interface MapData {
  spawnPoint: Vec3;
  blocks: MapBlock[];
  checkpoints: CheckpointData[];
  finish: FinishZoneData;
  ammoPickups: AmmoPickupData[];  // game-specific (uses WeaponType)
  // ...
}
```

### Cross-Boundary Exception: settingsStore

The `AudioManager` and `GpuParticles` read volume/quality settings from `settingsStore`. This is an accepted cross-boundary dependency because audio/video settings are engine-level concerns. Your game must provide a zustand store at `../../stores/settingsStore` (relative to engine root) with at minimum:

```typescript
interface SettingsState {
  masterVolume: number;   // 0-1
  sfxVolume: number;      // 0-1
  musicVolume: number;    // 0-1
  ambientVolume: number;  // 0-1
}
```

---

## Key Implementation Notes

### Rapier Physics

- Use `KinematicCharacterController`, NOT dynamic rigid body — full manual velocity control
- Set Rapier world gravity to `[0, 0, 0]` — engine applies gravity manually
- Pass `QueryFilterFlags.EXCLUDE_SENSORS` to `computeColliderMovement` — sensor colliders (zones, pickups) will otherwise block movement
- Physics accumulator pattern: step multiple times per frame to maintain 128Hz regardless of frame rate

### WebGPU Renderer

- `extend(THREE)` from `three/webgpu` must run before any `<Canvas>` renders
- Vite config: `target: 'esnext'` for both `optimizeDeps` and `build` (WebGPU uses top-level await)
- tsconfig target: `ESNext`
- R3F Canvas uses async `gl` prop for WebGPU renderer initialization
- Do NOT use `<color attach="background" />` — set `scene.background` imperatively

### PostProcessing

- Uses Three.js native `PostProcessing` class + TSL nodes (NOT @react-three/postprocessing)
- Bloom from `three/addons/tsl/display/BloomNode.js`
- Vignette computed via `viewportUV` TSL math
- `useFrame(() => pipeline.render(), 1)` with renderPriority=1 disables R3F auto-render

### GPU Particles

- TSL `instancedArray` for storage buffers
- `SpriteNodeMaterial` with additive blending
- Compute shaders for init + update
- No CPU readback — fully GPU-side simulation

---

## Package Dependencies

| Package | Version | Used By |
|---------|---------|---------|
| `three` | r171+ | Core, effects, stores |
| `@react-three/fiber` | v9 | All rendering components |
| `@react-three/rapier` | v2.2.0 | Physics (external, not in engine directly) |
| `@dimforge/rapier3d-compat` | * | setup-webgpu (WASM init), types (QueryFilterFlags, Ray) |
| `zustand` | v5 | Explosion store, dev log store |
| `react` | v19 | All components |
