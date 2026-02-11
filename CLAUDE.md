# VELOCITY — Project Guide

3D first-person speedrunning game (browser) — Quake/Source movement mechanics.

## Structure
```
backend/Velocity.Api/        ← Minimal API (.NET 10) — Configuration/, Endpoints/, Handlers/, Services/, Contracts/
backend/Velocity.Core/       ← Domain models & interfaces
backend/Velocity.Data/       ← EF Core + SQLite + repos
backend/Velocity.Tests/      ← xUnit
frontend/src/engine/         ← Generic reusable engine (core, physics, input, audio, effects, rendering, stores, hud, types)
frontend/src/game/           ← Velocity-specific (components, stores, services, hooks, types)
Plan.md                      ← Active plan — styr all utveckling
```

**Aliases:** `@engine/*` → `src/engine/*`, `@game/*` → `src/game/*`. Relative imports within same dir OK.

## Workflow
- `Plan.md` styr allt. Uppgift måste finnas där innan arbete. 🔲 → ✅ direkt vid klart.
- Fasordning respekteras. Håll `.claudeignore` uppdaterad.

## Rules

### TypeScript & Naming
- Strict TS, no `any`. Backend PascalCase, Frontend camelCase. API data mapped at boundary.

### No Magic Strings/Numbers
- Backend: `Configuration/`. Frontend: `as const` objects.

### No Warning/Error Suppression — fix root cause.

### Backend (C# 14 / .NET 10)
- `[Action][Entity]Request` / `[Entity]Response` (no Dto suffix), records in `Contracts/`
- Endpoints thin → logic in `Handlers/` (CQRS), Result Pattern (`IResult`)
- File-scoped namespaces, sealed, `IOptions<T>`, `ValueTask<T>` on repos
- `AsNoTracking()` reads, `CancellationToken` everywhere
- `SingleOrDefaultAsync` for unique, `FirstOrDefaultAsync` only with `OrderBy`

### Frontend (React 19 / Zustand)
- Max 150 lines/component → extract hooks
- Zustand selectors required, batched `set()`, `as const` config objects

### Engine/Game Boundary — CRITICAL
- `engine/` = generic, reusable. **MUST NOT** import `@game/*`.
- `game/` = Velocity-specific. MAY import `@engine/*`.
- Engine uses prop injection. Constants: `ENGINE_PHYSICS` (engine) → `PHYSICS` (game).
- Exception: `settingsStore` shared.

### Doc Comments
Top-of-file: Purpose, Dependencies, Used by. C# `/// <summary>`, TS `/** */`. Concise.

### Performance — Hot Path (128Hz Physics + 60Hz Render)
- No `set()` with `.map()`/`.filter()`/spread at 128Hz — mutable pools
- Pre-allocated vectors, mutate in-place. No PointLights — emissive material + bloom
- `instancedDynamicBufferAttribute` (NEVER `StorageInstancedBufferAttribute`)
- Target <200 draw calls, `MAX_SUBSTEPS = 4`, HUD ~30Hz

### Testing
- Pragmatic: test logic, not boilerplate. Vitest + xUnit. AAA. Mock via interfaces.

## Commands
```bash
# Run
cd backend/Velocity.Api && dotnet run --launch-profile https   # :5001
cd frontend && npm run dev                                      # :5173
# Build
dotnet build Velocity.slnx && cd frontend && npx tsc --noEmit && npx vite build
# Test
dotnet test && cd frontend && npx vitest run
```

## Key Tech
WebGPU (three/webgpu + R3F v9), TSL PostProcessing, Rapier KCC 128Hz, Zustand, Tailwind v4, manual gravity, Quake air accel, mutable projectile pool, screen nav via Zustand.

## Debugging
**devLog only** — never `console.log`. `devLog.info/warn/error('Source', msg)`.
