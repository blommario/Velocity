# VELOCITY — Project Guide

## What is this?
A 3D first-person speedrunning game (browser-based) inspired by Quake/Source engine movement mechanics.

## Project Structure
```
Velocity.slnx              ← Solution file (backend + frontend refs)
backend/
  Velocity.Api/             ← ASP.NET Core Minimal API (.NET 10)
    Configuration/          ← Options classes & centralized constants
    Endpoints/              ← Thin endpoint mapping
    Handlers/               ← CQRS business logic
    Services/               ← TokenService.cs
    Contracts/              ← Request/response records (no Dto suffix)
  Velocity.Core/            ← Domain models & interfaces
  Velocity.Data/            ← EF Core + SQLite + repositories
  Velocity.Tests/           ← xUnit backend tests
frontend/
  src/
    engine/                 ← Generic reusable engine (see Engine/Game Boundary)
      core/                 ← WebGPU setup, PostProcessing pipeline
      physics/              ← Quake movement math, constants, advanced movement
      input/                ← Input buffer, pointer lock
      audio/                ← AudioManager (Web Audio synth engine)
      effects/              ← GPU particles, explosions, screen shake
      rendering/            ← Engine-level rendering utils
      stores/               ← DevLog, PerfMonitor, settingsStore, editorStore, replayStore
      hud/                  ← Engine HUD primitives (Timer, SpeedMeter, Crosshair, etc.)
      types/                ← InputState, MovementState, MapBlock, Vec3, etc.
    game/                   ← Velocity-specific game code
      components/game/      ← PlayerController, TestMap, zones, effects
      components/game/physics/ ← Game physics tick, game constants (weapons, health)
      components/hud/       ← Game-specific HUD wrappers (Crosshair, CombatHud, etc.)
      components/editor/    ← Map editor UI
      components/menu/      ← MainMenu, AuthScreen, SettingsScreen, etc.
      stores/               ← Zustand (gameStore, combatStore, raceStore, authStore)
      services/             ← API client (fetch wrapper, no external deps)
      hooks/                ← Game-specific hooks
      types/                ← Game-specific types
Plan.md                     ← Active implementation plan (Fas G/H/I)
DESIGN.md                   ← Game design reference (in .claudeignore)
RESOURCES.md                ← External links/tutorials (in .claudeignore)
```

### Import Aliases
- **`@engine/*`** → `src/engine/*` (configured in tsconfig + vite)
- **`@game/*`** → `src/game/*` (configured in tsconfig + vite)
- Use aliases for cross-boundary imports. Relative imports within the same top-level dir are fine.

## Workflow

- **`Plan.md` styr all utveckling.** Varje uppgift måste finnas i Plan.md innan arbete påbörjas.
- **Nya features → Plan.md först.** Lägg till i rätt fas med 🔲 innan implementation.
- **Fasordning respekteras.** Påbörja inte fas innan beroenden är klara (✅).
- **Markera progress direkt.** 🔲 → ✅ omedelbart vid klart steg.
- **Håll `.claudeignore` uppdaterad.** När nya filer/mappar skapas som inte behövs i AI-context (assets, genererade filer, stora binärer, ren referensdokumentation), lägg till dem i `.claudeignore` direkt.

## Rules

### TypeScript & Naming
- **Strict TypeScript:** No `any`. Use `interface` or `type` for all data structures.
- **Naming:** Backend PascalCase, Frontend camelCase. API/SSE data mapped at boundary (`services/api.ts`).

### No Magic Strings / Numbers
- Backend: Centralize in `Configuration/` classes. Frontend: `as const` objects near consuming code.

### No Warning/Error Suppression
- Fix at root cause. Third-party: ask user how to proceed. Never silence.

### Backend Architecture (C# 14 / .NET 10)
- No Dto suffix — `[Action][Entity]Request` / `[Entity]Response`
- Records as Contracts (Primary Constructors) in `Contracts/`
- Endpoints thin (mapping only), all logic in `Handlers/` (CQRS)
- Result Pattern (`IResult`), never throw for validation
- File-scoped namespaces, sealed classes, `IOptions<T>` for config
- `ValueTask<T>` on repos, `AsNoTracking()` for reads, `CancellationToken` everywhere
- `SingleOrDefaultAsync` for unique lookup, `FirstOrDefaultAsync` only with `OrderBy`

### Frontend Architecture (React 19 / Zustand)
- Max 150 lines/component — extract to hooks
- Zustand selectors required (`useGameStore(s => s.score)`)
- Batched `set()` via dedicated actions
- Lookup tables for bindings (`Record<string, T>`)
- `as const` objects for thresholds/config

### Engine / Game Boundary — CRITICAL
The engine (`src/engine/`) is designed as a **general-purpose, reusable game engine** that can power any game — not just Velocity. Every generic/reusable feature MUST live in `src/engine/`. Only Velocity-specific gameplay logic belongs in `src/game/`.

- **`src/engine/`** = generic, reusable. MUST NOT import from `@game/*`.
- **`src/game/`** = Velocity-specific. MAY import from `@engine/*`.
- **Rule of thumb:** If a feature could be useful in another game (physics, rendering, input, audio, effects, UI primitives, networking, etc.) → it goes in `engine/`. If it's specific to Velocity's gameplay (speedrun timer, checkpoint zones, weapon balance, map formats) → it goes in `game/`.
- Engine uses **prop injection** (not game store reads).
- Constants: `ENGINE_PHYSICS` (engine) extended as `PHYSICS` (game).
- **Exception:** `settingsStore` lives in `engine/stores/` and may be imported by both engine and game code.

### Performance — Hot Path Rules (128Hz Physics + 60Hz Render)
- Never `set()` with `.map()`/`.filter()`/spread at 128Hz — use mutable pools
- Pre-allocated tuples/vectors on module level, mutate in-place
- No PointLights per entity — emissive `SpriteNodeMaterial` × 6.0 + bloom
- `instancedDynamicBufferAttribute` for CPU→GPU (NEVER `StorageInstancedBufferAttribute`)
- Instanced rendering: target <200 draw calls
- `MAX_SUBSTEPS = 4`, HUD at ~30Hz

### Testing & Quality
- Pragmatic: test complex logic, not UI boilerplate
- Vitest (Frontend), xUnit (Backend). AAA pattern.
- Mock repositories via interfaces. No integration leaks.

## How to Run
```bash
cd backend/Velocity.Api && dotnet run --launch-profile https   # Backend (5001)
cd frontend && npm run dev                                      # Frontend (5173)
```

## Build & Verify
```bash
dotnet build Velocity.slnx        # Backend
cd frontend && npx tsc --noEmit    # Frontend type check
cd frontend && npx vite build      # Frontend production build
```

## Tests
```bash
dotnet test                        # Backend xUnit
cd frontend && npx vitest run      # Frontend Vitest
```

## Tech Stack Summary
- **Backend:** Minimal API, SQLite/EF Core, JWT auth, rate limiting
- **Frontend:** WebGPU (`three/webgpu` + R3F v9), TSL PostProcessing (bloom, vignette, ACES), GPU particles (`instancedArray`/`instancedDynamicBufferAttribute`), Rapier KCC at 128Hz, Zustand, Tailwind v4
- **Key decisions:** Manual gravity (`[0,0,0]` in Rapier), Quake air accel (no total velocity cap), mutable projectile pool (zero GC), screen nav via Zustand (no Router)

## Dev Log & Debugging
**All debugging via DEV LOG** — never `console.log` directly. Use `devLog.info/warn/error('Source', msg)`.
- `devLogStore.ts` — store with `push()`, `updatePerf()`, `installErrorCapture()`
- `PerfMonitor.tsx` — measures frametime, updates store 1x/sec
- `DevLogPanel.tsx` — HUD overlay with perf bar + filter + log
- Source names: short, unique (`Physics`, `Combat`, `Renderer`, `Map`, etc.)
