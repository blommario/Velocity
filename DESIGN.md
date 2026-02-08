# VELOCITY — Game Design Reference

> Flyttat från CLAUDE.md för att minska AI-context. Referensdokumentation för speldesign.

## Game Modes
1. **Time Trial** — Solo runs against the clock with ghost replays
2. **Ghost Race** — Race against other players' ghost replays
3. **Live Race** — Up to 8 players simultaneously (ghosts, no collision)
4. **Practice/Sandbox** — Free roam, no timer, HUD enabled

## Movement Mechanics (Detailed Spec)

**Rocket Launcher:**
- Projectile speed: 900 u/s, explosion radius: 150 units
- Knockback: `force * (1 - distance/radius)` directional impulse
- Self-damage: 50% reduction, health regenerates over time
- Ammo: 3–5 rockets per map, strategic pickup placement

**Grenades:**
- Arc physics, bounce off surfaces, explode after 2.5s OR on second bounce
- Higher skill ceiling than rockets (timing-dependent)
- Ammo: 2–3 per map

**Wall Running:**
- Activation: jump toward wall at >200 u/s + strafe key toward wall
- Duration: max 1.5s, gradually losing height
- Can jump off wall for a boost at any point
- Cooldown: can't re-run same wall without touching ground
- Speed preservation: 90% of entry speed

**Crouch Sliding:**
- Press crouch while moving fast → slide with reduced friction
- Smaller capsule height, useful under barriers and on downhill

**Surfing:**
- Angled surfaces (30–60°) with zero friction
- Gravity pulls down slope, air strafing controls direction
- Alternating left/right ramps builds extreme speed

**Boost Pads:** +200–500 u/s instant velocity, fixed direction, glowing neon + arrows
**Launch Pads:** Angled boost pads that launch player at specific angle/speed
**Speed Gates:** Ring-shaped, multiply speed by 1.5x when passing at >400 u/s

**Grappling Hook:**
- Fires hook to marked grapple points (1–3 per map)
- Pendulum swing physics, release at bottom of arc for max horizontal velocity

## Map Data Structure
```typescript
interface MapData {
  spawnPoint: [number, number, number];
  spawnDirection: [number, number, number];
  blocks: MapBlock[];
  checkpoints: Checkpoint[];
  finish: FinishZone;
  boostPads: BoostPad[];
  launchPads: LaunchPad[];
  speedGates: SpeedGate[];
  grapplePoints: GrapplePoint[];
  ammoPickups: AmmoPickup[];
  surfRamps: SurfRamp[];
  movingPlatforms: MovingPlatform[];
  killZones: KillZone[];
  settings: MapSettings;
  skybox: SkyboxType;
  lighting: AmbientLighting;
}
```

## HUD Layout
```
┌─────────────────────────────────────────────────────┐
│  ⏱ 00:23.456                          🏁 CP 3/7    │
│                                                     │
│                        +                            │  ← Crosshair
│                                                     │
│  🚀 3/5  💣 2/2                                     │  ← Ammo
│  ████████████░░░░ 847 u/s                           │  ← Speed bar
│  ═══════════════════════════════════════════════     │  ← Track progress
└─────────────────────────────────────────────────────┘
```

## End-of-Run Screen
- Final time (large, centered) + comparison vs PB and WR
- Checkpoint split times breakdown
- Stats: max speed, total distance, jumps, rocket jumps, avg speed
- Actions: Retry, Watch Replay, Save Ghost, Back to Menu

## Replay System
- Record at 128Hz: position (x,y,z), rotation (pitch,yaw), input states, events
- Delta-compressed storage on backend
- Auto-save PB replay, top 10 per map on leaderboard
- Ghost streaming via SSE at 20–30Hz, client interpolates

## Rendering Style
- Stylized/clean aesthetic (NOT photorealistic)
- Bold geometry, strong directional lighting, colored ambient
- Emissive materials for boost pads, speed gates, neon
- PBR: low roughness metallic, high roughness rock/concrete
- HDR skyboxes per theme (mountain, city, industrial, sky)

## Performance Targets
- 60 FPS minimum on mid-range hardware
- Physics at 128Hz regardless of frame rate
- Draw calls under 200 per frame, instanced rendering for repeated geometry

## Known Issues & Debugging Notes

### R3F `<color>` Element Inkompatibelt med WebGPURenderer

**Status:** FIXAT med workaround.

**Fix:** Sätt `scene.background` imperativt i `useEffect`:
```tsx
import { Color } from 'three';
scene.background = new Color('#1a1a2e');
```
Använd ALDRIG `<color attach="background" .../>` med WebGPURenderer.
