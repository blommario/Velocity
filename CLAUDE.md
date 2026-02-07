# VELOCITY — Project Guide

## What is this?
A 3D first-person speedrunning game (browser-based) inspired by Quake/Source engine movement mechanics.

## Project Structure
```
Velocity.slnx              ← Solution file (backend + frontend refs)
backend/
  Velocity.Api/             ← ASP.NET Core Minimal API (.NET 10)
    Configuration/          ← Options classes & centralized constants (JwtSettings, ValidationRules, RateLimitPolicies)
    Endpoints/              ← Thin endpoint mapping (AuthEndpoints, MapEndpoints)
    Handlers/               ← CQRS business logic (AuthHandlers, MapHandlers)
    Services/               ← TokenService.cs
    Contracts/              ← Request/response records (named by role, no Dto suffix)
  Velocity.Core/            ← Domain models & interfaces
  Velocity.Data/            ← EF Core + SQLite + repositories
  Velocity.Tests/           ← xUnit backend tests
frontend/
  src/
    components/game/        ← Game renderer, PlayerController, TestMap
    components/game/physics/ ← Quake movement (useMovement, useInputBuffer, constants)
    components/hud/         ← SpeedMeter, Timer, Crosshair, HudOverlay
    stores/                 ← Zustand (gameStore, settingsStore)
    services/               ← API client (fetch wrapper, no external deps)
Plan.md                     ← Implementation plan (12 faser med beroenden)
```

## Workflow

- **`Plan.md` styr all utveckling.** Varje uppgift som ska implementeras måste finnas som ett steg i Plan.md innan arbetet påbörjas.
- **Nya features → Plan.md först.** Om flera features ska skapas, lägg till dem i rätt fas i Plan.md med 🔲 innan implementation börjar. Arbeta aldrig på något som inte finns i planen.
- **Fasordning respekteras.** Varje fas har förutsättningar — påbörja inte en fas innan dess beroenden är klara (✅).
- **Markera progress direkt.** När ett steg är klart, uppdatera Plan.md (🔲 → ✅) omedelbart.
- **CLAUDE.md = regler & referens, Plan.md = vad som ska göras.** Blanda aldrig implementation-tasks i CLAUDE.md.

## Rules

### TypeScript & Naming
- **Strict TypeScript:** No `any` allowed. Use `interface` or `type` for all data structures.
- **Naming Boundary:** - Backend: **PascalCase**
  - Frontend: **camelCase**
  - All API/SSE data MUST be mapped to camelCase at the frontend boundary (`services/api.ts`).

### No Magic Strings / Numbers
- Strings and numbers used for configuration, routes, statuses, IDs, validation limits, or thresholds must NOT be hardcoded in logic.
- **Backend:** Centralize in `Configuration/` classes (`ValidationRules`, `ValidationMessages`, `RateLimitPolicies`). Use `const` fields for compile-time values and `static readonly` for runtime values.
- **Frontend:** Use `as const` objects co-located with or near the consuming code (e.g., `SPEED_METER`, `DEFAULT_KEY_BINDINGS`, `MAP_DIFFICULTIES`).
- This also applies to CSS classes when used in conditional logic.

### Backend Architecture (C# 14 / .NET 10)
- **Inga Dto-suffix:** Använd aldrig ordet "Dto". Namnge efter roll: `[Action][Entity]Request` (t.ex. `CreateMapRequest`) eller `[Entity]Response` (t.ex. `MapResponse`).
- **Records som Contracts:** Använd `public record` med Primary Constructors för alla Request/Response-objekt. Dessa ligger i `Contracts/`.
- **Minimal API & Handlers:** Endpoints i `Endpoints/` MÅSTE vara tunna — enbart request/response-mappning. All affärslogik och DB-åtkomst MÅSTE ligga i `Handlers/` (CQRS-mönster).
- **Result Pattern:** Returnera `IResult` från Handlers istället för att kasta exceptions vid valideringsfel eller saknade resurser. Använd `Results.BadRequest()`, `Results.NotFound()`, `Results.Conflict()` etc.
- **Single Responsibility:** En Handler ska bara göra en sak. Om logiken blir för komplex, bryt ut den i en specifik domäntjänst i `Services/`.
- **File-Scoped Namespaces:** Använd alltid file-scoped namespaces (`namespace X;`) för att minska indentering.
- **C# 14 Features:** Använd `field` keyword för auto-properties och `params` Collections (t.ex. `params List<T>`) där det förenklar koden.
- **Options Pattern:** All konfiguration (JWT, rate limits etc.) MÅSTE använda `IOptions<T>` — aldrig råa `IConfiguration["key"]`-anrop. Options-klasser ligger i `Configuration/` med `SectionName`-konstant.
- **Centralized Constants:** Valideringsgränser (`ValidationRules`), felmeddelanden (`ValidationMessages`), rate limit-policyer (`RateLimitPolicies`) — alla centraliserade i `Configuration/`. Aldrig hårdkodade i handlers.
- **Sealed Classes:** Klasser som inte designas för arv (handlers, repositories, services) MÅSTE vara `sealed`.
- **ValueTask på repositories:** Alla repository-interfacemetoder MÅSTE returnera `ValueTask<T>` (inte `Task<T>`) för att minska allokeringar.
- **AsNoTracking:** Alla read-only EF Core-queries MÅSTE använda `.AsNoTracking()` för bättre prestanda.
- **Guid.TryParse Guard:** Använd aldrig `Guid.Parse()` med null-forgiving `!`. Använd `Guid.TryParse()` + Result Pattern (`Results.Problem(statusCode: 401)`).
- **Pagination Validation:** Alla paginerade endpoints MÅSTE validera `page` och `pageSize` med fallback-värden (t.ex. `page < 1 → 1`, `pageSize > 100 → 20`).
- **Max Length Validation:** Validera maxlängd i handlers för att matcha DB-constraints (t.ex. `UsernameMaxLength = 50`).
- **LINQ Query Rules:**
  - **SingleOrDefaultAsync** för queries som förväntar EN entitet eller null (t.ex. lookup via Id, Username). Garanterar exception vid duplikat.
  - **FirstOrDefaultAsync** ENBART i kombination med **OrderBy** — aldrig utan explicit sortering.
  - **FindAsync** ENBART för primärnyckel-lookup utan Include/AsNoTracking (DbContext cache-hit).
- **CancellationToken:** Alla async-metoder (repositories, handlers) MÅSTE acceptera och vidarebefordra `CancellationToken ct`. Alla EF Core-anrop (`SaveChangesAsync`, `SingleOrDefaultAsync`, `ToListAsync`, `FindAsync` etc.) MÅSTE skicka `ct`.
- **Performance:** Använd `ReadOnlySpan<T>` för physics-relaterad string/data-parsning där det är tillämpligt.

### Frontend Architecture (React 19 / Zustand)
- **Component Limits:** Max 150 lines per component. Larger logic must be moved to Custom Hooks (e.g., `useMovement.ts`).
- **Zustand Performance:** Components MUST use selectors (e.g., `const score = useGameStore(s => s.score)`) to prevent unnecessary re-renders.
- **Dispatch Pattern:** All state mutations must be encapsulated in actions within the store. No direct state mutation in components.
- **Batched Zustand Updates:** Relaterade state-ändringar MÅSTE göras i ett enda `set()`-anrop via en dedikerad action (t.ex. `updateHud({ speed, position, grounded })`), inte flera separata `set()`-anrop.
- **Lookup Tables for Bindings:** Tangentbindningar och liknande mappningar MÅSTE vara `Record<string, T>`-objekt — aldrig duplicerade switch/if-kedjor. Exempel: `DEFAULT_KEY_BINDINGS: Record<string, keyof InputState>`.
- **Extracted Constants:** UI-thresholds, färgvärden, och display-gränser MÅSTE definieras som `as const`-objekt nära komponenten (t.ex. `SPEED_METER.THRESHOLDS`, `HUD_UPDATE_HZ`).

### Communication & Data
- **SSE:** All SSE data must be JSON-serialized. Field names must be mapped from PascalCase to camelCase upon receipt.
- **API Calls:** Use the plain fetch wrapper in `services/api.ts`. All responses must be strictly typed against the expected JSON structure.

### Design for Testability
- **Systemet MÅSTE designas för testbarhet.** Alla tjänster, handlers och repositories ska kunna testas isolerat.
- **Dependency Injection:** Alla beroenden injiceras via constructor — aldrig `new` inuti klasser (utom domain entities). `IOptions<T>` för konfiguration, interfaces för repositories.
- **Interface-first Repositories:** Varje repository har ett `I[Name]Repository`-interface i `Velocity.Core`. Handlers beror på interface, inte konkret implementation → enkelt att mocka.
- **Pure Functions:** Extrahera logik till rena funktioner utan sidoeffekter där möjligt (t.ex. `getSpeedColor(speed)`, `applyFriction(velocity, friction, dt)`). Dessa är triviala att enhetstesta.
- **No Static State:** Undvik statiska mutable tillstånd. Använd Zustand stores (frontend) eller DI-scoped services (backend) istället.
- **Testable Configuration:** Alla konfigurationsvärden via `IOptions<T>` → enkelt att skapa test-konfiguration med `Options.Create(new JwtSettings { ... })`.

### Testing & Quality
- **Pragmatic Testing:** Focus on complex logic (movement math, token generation, auth handlers, validation) rather than UI boilerplate.
- **Edge Cases:** Prioritize "breaking" the logic over 100% coverage. Test gränsvärden (min/max längd, ogiltiga GUID, tomma strängar).
- **Tools:** Vitest (Frontend), xUnit (Backend).
- **Test Structure:** Arrange-Act-Assert pattern. Tydliga testnamn som beskriver scenario: `MethodName_Scenario_ExpectedResult`.
- **No Integration Leaks:** Enhetstester ska INTE bero på databas, nätverk, eller filsystem. Mocka repositories via interfaces.

## Physics Constants (128Hz Tick Rate)
- Ground: max speed 320 u/s, friction 6.0, accel 10
- Air: accel 10, speed cap 30 (per-tick), no total velocity cap
- Jump: 270 u/s instant, 50ms buffer window
- Gravity: 800 u/s²

## Conventions
- **Backend:** C# 14, .NET 10, Primary Constructors, Minimal API endpoint groups.
- **Frontend:** React 19, Tailwind CSS v4, Zustand.
- **Imports:** Clean relative paths or absolute paths if configured.
- **Naming:** camelCase in frontend, PascalCase in backend — SSE/API responses mapped at the boundary.

## How to Run
```bash
# Backend (terminal 1) — HTTPS on 5001, HTTP on 5000
cd backend/Velocity.Api && dotnet run --launch-profile https

# Frontend (terminal 2)
cd frontend && npm run dev
```
- Backend: https://localhost:5001 (primary), http://localhost:5000 (redirects to HTTPS)
- Frontend: http://localhost:5173 (proxies /api → https://localhost:5001)
- Dev SSL cert: `dotnet dev-certs https --trust` (auto-trusted on first `dotnet run`)

## Build & Verify
```bash
dotnet build Velocity.slnx        # Backend (all 3 projects)
cd frontend && npx tsc --noEmit    # Frontend type check
cd frontend && npx vite build      # Frontend production build
```

## Tests
```bash
dotnet test                        # Backend xUnit tests
cd frontend && npx vitest run      # Frontend Vitest tests
```

## Backend Stack
- **API style:** Minimal API (no controllers) — endpoint groups in `Endpoints/`
- **Database:** SQLite for dev (auto-created via EnsureCreated), EF Core ORM — swap to Postgres later
- **Auth:** JWT Bearer tokens (register/login/guest)
- **Middleware:** Error handling (`UseExceptionHandler`), response compression, CORS, rate limiting on auth
- **OpenAPI:** Available at `/openapi/v1.json` in dev mode
- **Health checks:** `/health` endpoint with EF Core DB check
- **Rate limiting:** Fixed window (10 req/min) on `/api/auth/*`

## Frontend Stack
- **Renderer:** WebGPU via `three/webgpu` + R3F v9 async `gl` prop (auto-fallback to WebGL2)
- **PostProcessing:** Three.js native `PostProcessing` class + TSL nodes (bloom, vignette, ACES tonemapping)
- **Fog:** TSL `scene.fogNode` with `fog()` + `rangeFogFactor()` for height-based atmospheric fog
- **Particles:** GPU compute shaders via TSL `instancedArray` + `SpriteNodeMaterial`
- **Instancing:** `InstancedBlocks` groups map blocks by visual properties for fewer draw calls
- **Physics:** @react-three/rapier v2.2.0 — KinematicCharacterController at 128Hz
- **State:** Zustand (gameStore, settingsStore)
- **Styling:** Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **API client:** Thin fetch wrapper (`services/api.ts`), zero external HTTP deps
- **No SSE/WebSocket yet** — planned for Phase 7 (multiplayer)

## Key Architecture Decisions
- **Physics body:** Rapier KinematicCharacterController, NOT a dynamic body — full manual velocity control
- **Gravity:** Rapier gravity set to `[0, 0, 0]` — handled manually in `useMovement.ts` to avoid double-gravity
- **Movement:** Quake air acceleration formula with no total velocity cap (air speed cap=30 per-tick only)
- **Input:** Buffered between frames (keyboard booleans + accumulated mouse deltas)
- **HUD:** Updated at ~30Hz (not 128Hz) to avoid excessive React re-renders
- **Minimal API over Controllers:** Less boilerplate, endpoint groups for organization
- **CQRS-like Handlers:** Endpoints are thin — all business logic in `Handlers/` (AuthHandlers, MapHandlers)
- **Screen navigation:** Zustand state (`SCREENS` const) instead of React Router

## API Endpoints (Minimal API)

### Implemented ✅
- `POST /api/auth/register` — Register (username + password) [rate limited]
- `POST /api/auth/login` — Login → JWT [rate limited]
- `POST /api/auth/guest` — Guest session → JWT [rate limited]
- `GET /api/maps` — List maps (filters: isOfficial, difficulty, page, pageSize)
- `GET /api/maps/{id}` — Map details + MapDataJson
- `POST /api/maps` — Create map (requires auth)
- `GET /health` — Health check

### Planned 🔲
- `PUT /api/maps/{id}` — Update map (author only)
- `DELETE /api/maps/{id}` — Delete map (author only)
- `POST /api/maps/{id}/like` — Like a map
- `GET /api/maps/{id}/leaderboard` — Top 100 leaderboard
- `POST /api/runs` — Submit run (time, stats, replay data)
- `GET /api/runs/{id}` — Run details
- `GET /api/runs/{id}/replay` — Download replay data
- `GET /api/maps/{id}/my-runs` — Player's runs for a map
- `GET /api/players/{id}/profile` — Player profile + stats
- `POST /api/friends/add` — Add friend
- `GET /api/friends` — List friends
- `GET /api/activity` — Activity feed
- `GET /api/sse/leaderboard/{mapId}` — Live leaderboard updates (SSE)
- `GET /api/sse/race/{roomId}` — Live race events (SSE)
- `GET /api/sse/activity` — Live activity feed (SSE)
- `POST /api/rooms` — Create race room
- `GET /api/rooms/{id}` — Room details
- `POST /api/rooms/{id}/join` — Join room
- `POST /api/rooms/{id}/ready` — Mark ready
- `POST /api/rooms/{id}/start` — Start race (host)

---

## Game Design Reference

### Game Modes
1. **Time Trial** — Solo runs against the clock with ghost replays
2. **Ghost Race** — Race against other players' ghost replays
3. **Live Race** — Up to 8 players simultaneously (ghosts, no collision)
4. **Practice/Sandbox** — Free roam, no timer, HUD enabled

### Movement Mechanics (Detailed Spec)

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

### Map Data Structure
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
  settings: MapSettings;       // gravity override, max rockets, etc.
  skybox: SkyboxType;
  lighting: AmbientLighting;
}
```

### Official Maps
| Map | Difficulty | Theme | Key Mechanics | Par | WR Potential |
|-----|-----------|-------|---------------|-----|-------------|
| First Steps | Easy | Tutorial | Strafe jump, bhop | 45s | ~25s |
| Cliffside | Medium | Rocky mountain | Surf ramps, rocket jumps | 90s | ~45s |
| Neon District | Medium | Cyberpunk | Wall running, speed gates, boosts | 75s | ~35s |
| The Gauntlet | Hard | Industrial | All mechanics | 120s | ~55s |
| Skybreak | Expert | Floating islands | Grappling hook, extreme rockets | 180s | ~80s |

### HUD Layout
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

### End-of-Run Screen
- Final time (large, centered) + comparison vs PB and WR
- Checkpoint split times breakdown
- Stats: max speed, total distance, jumps, rocket jumps, avg speed
- Actions: Retry, Watch Replay, Save Ghost, Back to Menu

### Replay System
- Record at 128Hz: position (x,y,z), rotation (pitch,yaw), input states, events
- Delta-compressed storage on backend
- Auto-save PB replay, top 10 per map on leaderboard
- Ghost streaming via SSE at 20–30Hz, client interpolates

### Leaderboard
- Top 100 global per map + friends leaderboard + personal history
- Anti-cheat: server validates run duration vs checkpoint timestamps, max speed sanity
- Real-time updates via SSE when WR is beaten

### Multiplayer
- Race rooms: create/join via link, up to 8 players, ghost rendering (no collision)
- Matchmaking: ELO from average percentile, quick match (random official map), ranked (weekly rotation)
- Social: player profiles, friends list, activity feed via SSE

### Rendering Style
- Stylized/clean aesthetic (NOT photorealistic)
- Bold geometry, strong directional lighting, colored ambient
- Emissive materials for boost pads, speed gates, neon
- PBR: low roughness metallic, high roughness rock/concrete
- HDR skyboxes per theme (mountain, city, industrial, sky)

### Performance Targets
- 60 FPS minimum on mid-range hardware
- Physics at 128Hz regardless of frame rate
- Draw calls under 200 per frame, instanced rendering for repeated geometry

---

## Technical References & Sources

### WebGPU Renderer Migration
- [R3F v9 Migration Guide — WebGPU canvas setup, async `gl` prop](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)
- [R3F Canvas API — `gl` prop documentation](https://r3f.docs.pmnd.rs/api/canvas)
- [R3F WebGPU Starter (ektogamat) — reference implementation](https://github.com/ektogamat/r3f-webgpu-starter)
- [R3F WebGPU Support Issue #3352 — community discussion](https://github.com/pmndrs/react-three-fiber/issues/3352)
- [Pragmattic: R3F WebGPU + TypeScript setup](https://blog.pragmattic.dev/react-three-fiber-webgpu-typescript)
- [Loopspeed: R3F WebGPU with TypeScript](https://blog.loopspeed.co.uk/react-three-fiber-webgpu-typescript)

### Three.js TSL & PostProcessing
- [Three.js Shading Language Wiki — full TSL node reference](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [Three.js WebGPU Bloom Example](https://threejs.org/examples/webgpu_postprocessing_bloom.html)
- [Three.js WebGPU Custom Fog Example](https://threejs.org/examples/webgpu_custom_fog.html)
- [Three.js WebGPU Instance Mesh Example](https://threejs.org/examples/webgpu_instance_mesh.html)
- [Three.js Migration Guide — PostProcessing → RenderPipeline (r183)](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
- [Maxime Heckel: Field Guide to TSL and WebGPU](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- [Wawa Sensei: WebGPU/TSL with R3F — course](https://wawasensei.dev/courses/react-three-fiber/lessons/webgpu-tsl)
- [Wawa Sensei: GPGPU Particles with TSL](https://wawasensei.dev/courses/react-three-fiber/lessons/tsl-gpgpu)
- [Codrops: BatchedMesh + WebGPU PostProcessing (vignette, SSAO, DoF)](https://tympanus.net/codrops/2024/10/30/interactive-3d-with-three-js-batchedmesh-and-webgpurenderer/)
- [Galaxy Simulation with WebGPU Compute Shaders](https://threejsroadmap.com/blog/galaxy-simulation-webgpu-compute-shaders)

### Three.js Core Documentation
- [Three.js WebGPURenderer Docs](https://threejs.org/docs/pages/WebGPURenderer.html)
- [Three.js TSL Docs](https://threejs.org/docs/pages/TSL.html)
- [Three.js Fog Docs](https://threejs.org/docs/pages/Fog.html)
- [Three.js Releases (r171–r182)](https://github.com/mrdoob/three.js/releases)

### WebGPU Browser Support
- [WebGPU Implementation Status (GPU Web Wiki)](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- [Can I Use: WebGPU](https://caniuse.com/webgpu)
- [web.dev: WebGPU supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers)

### Visual Inspiration — Project Prismatic
- [Project Prismatic on CrazyGames — first WebGPU title](https://www.crazygames.com/game/project-prismatic)
- [Pocket Gamer: First WebGPU game on CrazyGames](https://www.pocketgamer.com/project-prismatic/the-first-webgpu-game-launched-on-crazygames/)
- [Unity WebGPU Transformation (GDC summary) — LOD, compression, compute shaders](https://gist.ly/youtube-summarizer/advances-in-gaming-on-the-web-unitys-transformation-with-webgpu)
- [Gamedev.js: Project Prismatic — WebGPU powered FPS](https://gamedevjs.com/games/project-prismatic-webgpu-powered-fps/)
- [PlayOnRay: Project Prismatic Preview — atmospheric lighting breakdown](https://playonray.com/blog/project-prismatic-preview-scifi-fps-web-gaming)
- [Bleeding Cool: Project Prismatic Announced](https://bleedingcool.com/games/sci-fi-web-based-fps-project-prismatic-announced/)

### WebGPU Samples (Official)
- [WebGPU Samples — 52 reference implementations](https://webgpu.github.io/webgpu-samples/)
- [computeBoids — compute shader init+update pattern](https://webgpu.github.io/webgpu-samples/samples/computeBoids)
- [particles — GPU particle system with compute shaders](https://webgpu.github.io/webgpu-samples/samples/particles)
- [instancedCube — instanced rendering reference](https://webgpu.github.io/webgpu-samples/samples/instancedCube)
- [imageBlur — compute-based blur (bloom reference)](https://webgpu.github.io/webgpu-samples/samples/imageBlur)
- [deferredRendering — deferred shading pipeline](https://webgpu.github.io/webgpu-samples/samples/deferredRendering)
- [shadowMapping — WebGPU shadow mapping](https://webgpu.github.io/webgpu-samples/samples/shadowMapping)
- [clusteredShading — many dynamic lights](https://webgpu.github.io/webgpu-samples/samples/clusteredShading)
- [a-buffer — order-independent transparency](https://webgpu.github.io/webgpu-samples/samples/a-buffer)
- [volumeRenderingTexture3D — volumetric fog reference](https://webgpu.github.io/webgpu-samples/samples/volumeRenderingTexture3D)

### Three.js Forum Discussions
- [WebGPU Performance Regression in r182 vs WebGL r170](https://discourse.threejs.org/t/webgpu-significant-performance-drop-and-shadow-quality-regression-in-r182-vs-webgl-r170/89322)
- [stats-gl Incompatibility with WebGPU in r181](https://discourse.threejs.org/t/webgpu-r181-fyi-stats-gl-no-longer-compatible-with-webgpu/87944)
- [WebGPU Post-Processing Effects discussion](https://discourse.threejs.org/t/three-js-webgpu-post-processing-effects/87390)
- [DataTexture regression in r171](https://github.com/mrdoob/three.js/issues/30484)

---

## Known Issues & Debugging Notes

### 🟡 R3F `<color>` Element Inkompatibelt med WebGPURenderer

**Status:** FIXAT med workaround.

**Symptom:** `<color attach="background" args={['#1a1a2e']} />` i JSX sätter INTE `scene.background` korrekt med `extend(THREE)` från `three/webgpu`. `Background.update()` får `undefined` och kastar `TypeError: Cannot read properties of undefined (reading 'isColor')` varje frame.

**Fix:** Sätt `scene.background` imperativt i `useEffect`:
```tsx
import { Color } from 'three';
scene.background = new Color('#1a1a2e');
```
Använd ALDRIG `<color attach="background" .../>` med WebGPURenderer.
