# VELOCITY — Implementation Plan

> Varje fas bygger på föregående. Steg inom en fas kan ofta göras parallellt.
> ✅ = klart | 🔲 = kvar

---

## Fas 1 — Grundplattform
*Scaffolding, tooling, projektstruktur. Allt som resten bygger på.*

- ✅ Git-repo + `.gitignore` (Node + C#)
- ✅ `Velocity.slnx` med backend + frontend som solution folder
- ✅ Backend: 3-projekt-struktur (`Velocity.Api`, `Velocity.Core`, `Velocity.Data`)
- ✅ Frontend: Vite + React 19 + TypeScript + Tailwind CSS v4
- ✅ Beroenden: three, R3F, drei, rapier, zustand
- ✅ Vite-proxy (`/api` → `localhost:5000`)
- ✅ Vitest (frontend) + xUnit (backend) testramverk
- ✅ CLAUDE.md + Plan.md

---

## Fas 2 — Rörelse & Fysik (128Hz)
*Kärnan i spelet. Ingen mening att bygga banor/UI utan att rörelsen känns rätt.*

**Förutsättning:** Fas 1

- ✅ R3F-scen med Physics provider (128Hz fixed timestep, gravity `[0,0,0]`)
- ✅ `useInputBuffer` — tangentbord (WASD/jump/crouch) + mus-delta-ackumulering
- ✅ `PlayerController` — KinematicCharacterController med manuell velocity
- ✅ Mark-rörelse: friktion (6.0), acceleration (10), max 320 u/s
- ✅ Luft-rörelse: Quake air accel med `AIR_SPEED_CAP=30` per-tick, inget totaltak
- ✅ Hopp: 270 u/s instant, 50ms buffer, auto-bhop
- ✅ Manuell gravitation (800 u/s²) istället för Rapier-gravity
- ✅ Enhetstester för rörelsematematik (17 Vitest-tester)
- ✅ Finjustera rörelsekänsla — verifiera strafe jump speed-gain, bhop-momentum (25 tester)
- ✅ Crouch sliding — reducerad friktion + mindre kapsel vid hög hastighet

---

## Fas 3 — Gameplay Loop
*Checkpoints, timer, mål, respawn. Gör det möjligt att faktiskt "spela" en bana.*

**Förutsättning:** Fas 2 (fungerande rörelse)

- ✅ `StartZone`-komponent — triggar timer vid spelarpassage
- ✅ `Checkpoint`-komponent — kollisionsdetektion, sparar split-tid
- ✅ `FinishZone`-komponent — stoppar timer, visar resultat
- ✅ `GameLoop`-logik i `gameStore` — tillstånd: Ready → Running → Finished
- ✅ Respawn-system — fall utanför banan → återställ till senaste checkpoint
- ✅ Kill zones — dödsytor med respawn
- ✅ End-of-run modal:
  - Sluttid (stort, centrerat) + jämförelse vs PB och WR
  - Checkpoint split-tider
  - Stats: max speed, total distance, jumps, rocket jumps, avg speed
  - Knappar: Retry, Watch Replay, Save Ghost, Back to Menu

---

## Fas 4 — HUD & Visuellt
*Spelaren behöver feedback. Beror på gameplay loop för timer/splits.*

**Förutsättning:** Fas 3 (timer + checkpoints finns)

- ✅ SpeedMeter — färgkodad (vit→gul→orange→röd) + numeriskt värde
- ✅ Timer — mm:ss.mmm precision
- ✅ Crosshair — minimal dot
- 🔲 Checkpoint-räknare — "CP 3/7" uppe till höger
- 🔲 Split-tider — popup vid checkpoint (+/- vs PB, grön/röd)
- 🔲 Track progress bar — tunn bar längst ner
- 🔲 FOV-skalning — 90° bas → 110° vid 500 u/s → 120° vid 800+ u/s
- 🔲 Speed lines — subtila radiella linjer vid höga hastigheter
- 🔲 Screen shake — minimal vid explosioner (toggle i settings)

---

## Fas 5 — Backend & Auth
*API-infrastruktur. Banor och leaderboards behöver backend.*

**Förutsättning:** Fas 1

- ✅ EF Core + SQLite (auto-create i dev)
- ✅ Domänmodeller: `Player`, `GameMap`, `Run`, `LeaderboardEntry`, `MapDifficulty`
- ✅ Repository-interfaces + implementationer
- ✅ JWT Bearer auth (register/login/guest)
- ✅ CQRS Handlers (`AuthHandlers`, `MapHandlers`)
- ✅ Rate limiting (10 req/min på auth)
- ✅ CORS, response compression, health check, OpenAPI
- ✅ Backend-tester (3 xUnit-tester: TokenService)
- 🔲 `RunRepository`-implementation
- 🔲 `RunHandler` + `RunEndpoints` — `POST /api/runs`, `GET /api/runs/{id}`
- 🔲 `LeaderboardHandler` + `LeaderboardEndpoints` — `GET /api/maps/{id}/leaderboard`
- 🔲 Maps CRUD: `PUT /api/maps/{id}`, `DELETE /api/maps/{id}`
- 🔲 Maps like: `POST /api/maps/{id}/like`
- 🔲 Spelprofiler: `GET /api/players/{id}/profile`

---

## Fas 6 — Frontend ↔ Backend Integration
*Koppla ihop spelet med API:et.*

**Förutsättning:** Fas 3 (gameplay loop) + Fas 5 (backend endpoints)

- 🔲 Auth-flow i frontend — guest-login vid start, token i Zustand/localStorage
- 🔲 `authStore` — token, player info, login/register/guest actions
- 🔲 Skicka run till backend vid slutförd bana (tid, stats, checkpoint-tider)
- 🔲 Hämta leaderboard per bana och visa i UI
- 🔲 Hämta bandata (MapDataJson) från backend och rendera i R3F
- 🔲 Main Menu — banlista hämtad från API med filter/sökning

---

## Fas 7 — Avancerad Rörelse
*Nya mekaniker. Kräver att basrörelse + gameplay loop fungerar.*

**Förutsättning:** Fas 3 (gameplay loop — för att testa mekanikerna på riktiga banor)

### 7a — Vapen & Explosioner
- 🔲 Raketgevär — projektil (900 u/s), explosion vid impact
- 🔲 Rocket jump — knockback baserat på avstånd, 50% self-damage
- 🔲 Granater — arc-fysik, studs, 2.5s timer
- 🔲 Grenade jump — timing + knockback
- 🔲 Ammo-system — begränsad ammo per bana, ammo pickups
- 🔲 Health-system — self-damage + regeneration

### 7b — Rörelse-mekaniker
- 🔲 Wall running — väggdetektion + strafe key, 1.5s max, 90% speed preservation
- 🔲 Surfing — vinklade ytor (30–60°), noll friktion, gravity-driven
- 🔲 Boost pads — instant velocity-addition i fast riktning
- 🔲 Launch pads — vinklade boost pads (luftsläng)
- 🔲 Speed gates — 1.5x speed multiplier vid >400 u/s

### 7c — Grappling Hook
- 🔲 Hook-projektil som fäster vid grapple-punkter
- 🔲 Pendel-fysik (swing)
- 🔲 Momentum transfer vid release

---

## Fas 8 — Banor
*Riktiga banor kräver att alla mekaniker finns + bandata kan laddas.*

**Förutsättning:** Fas 7 (alla mekaniker) + Fas 6 (map loading från API)

- 🔲 MapData JSON-format — spawn, blocks, checkpoints, finish, objekt, settings (se CLAUDE.md)
- 🔲 Map loader — parsa JSON → R3F-komponenter (block renderers, game objects)
- 🔲 **"First Steps"** (Easy) — Tutorial: korridorer, kurvor, små gap. Ghost guide. Par: 45s / WR: ~25s
- 🔲 **"Cliffside"** (Medium) — Klippor, klippstigar, stenbroar. Surf ramps, rocket jump shortcuts. Hemlig grotta (kräver rocket jump). Par: 90s / WR: ~45s
- 🔲 **"Neon District"** (Medium) — Cyberpunk-stad, neonljus, glasyta. Wall running, speed gates, boost pads. Takvägs-genväg via grenade jump. Par: 75s / WR: ~35s
- 🔲 **"The Gauntlet"** (Hard) — Industriell/mekanisk, rörliga plattformar, roterande hinder. Kräver alla mekaniker. Flera rutter med risk/reward. Par: 120s / WR: ~55s
- 🔲 **"Skybreak"** (Expert) — Flytande öar i himlen, tunna broar, grapple points. Tung grappling hook + surf + extreme rocket jumps. Fall = respawn. Par: 180s / WR: ~80s

---

## Fas 9 — Ghost & Replay
*Kräver att banor kan spelas och runs sparas.*

**Förutsättning:** Fas 6 (run submission) + Fas 8 (spelbara banor)

- 🔲 Replay-inspelning — position + rotation + inputs vid 128Hz, delta-komprimering
- 🔲 Replay-lagring på backend (`POST /api/runs/{id}/replay`)
- 🔲 Ghost-rendering — semi-transparent spelarmodell som följer replay-data
- 🔲 Race mot ghost — PB, WR, vänner
- 🔲 Download/streaming av replay-data

---

## Fas 10 — Map Editor
*Kräver att MapData-formatet finns + API för att spara.*

**Förutsättning:** Fas 8 (map format definierat)

- 🔲 Editor-layout: vänster = objektpalett, höger = egenskaper, topp = fil/undo/grid, 3D viewport
- 🔲 Fri kamera — WASD + mus (fly mode)
- 🔲 Block placement — snap-to-grid, cubes, ramps, cylindrar, wedges
- 🔲 Material/textur-väljare — sten, metall, neon, glas, is (PBR-material)
- 🔲 Objekt-palett — boost pads, launch pads, grapple points, checkpoints, start/finish, kill zones, ammo pickups
- 🔲 Transform controls — G (grab/move), R (rotate), S (scale)
- 🔲 Moving platforms — waypoint-editor + hastighetsinställning
- 🔲 Lighting presets — dagsljus, solnedgång, natt, neon
- 🔲 Test play — Tab för att växla editor ↔ playtest (spelar från aktuell position)
- 🔲 Undo/redo — full historik-stack (Ctrl+Z / Ctrl+Y)
- 🔲 Copy/paste — duplicera sektioner
- 🔲 Spara/ladda/publicera till backend + delbar URL
- 🔲 Auto-validering — varning om start/finish saknas, oåtkomliga areas
- 🔲 Community browser — rating, tags (difficulty, style), sökning

---

## Fas 11 — Ljud & Polish
*Förhöjer upplevelsen. Kräver att spelet är spelbart.*

**Förutsättning:** Fas 8 (spelbar bana med mekaniker)

- 🔲 Fotsteg — varierar per yta (metall, sten, glas), hastighetsbaserat tempo
- 🔲 Hopp/landning — satisfying ljud, impact skalat efter fallhöjd
- 🔲 Raket — launch sound, explosion med bas
- 🔲 Granat — pin pull, studs, explosion
- 🔲 Grappling hook — kedja, spänning, release-snap
- 🔲 Boost/speed gate — elektronisk woosh
- 🔲 Checkpoint ding + finish fanfare
- 🔲 Ambient — per-bana (vind, stadsljud, mekaniskt)
- 🔲 Settings-meny:
  - Mus-sensitivity (med test-yta)
  - FOV-slider (80–130)
  - Keybindings (fullt rebindable)
  - Ljud: master, SFX, musik
  - Grafik: quality presets (Low/Med/High/Ultra), shadows, particles, post-processing
  - HUD: toggle individuella element, skala, opacity
  - Gameplay: auto-bhop toggle, crosshair-stil/färg

---

## Fas 12 — Multiplayer & SSE
*Sista fasen. Kräver ghost-system + stabil backend.*

**Förutsättning:** Fas 9 (ghost rendering) + Fas 6 (auth + API)

- 🔲 SSE-streams: `/api/sse/leaderboard/{mapId}`, `/api/sse/race/{roomId}`, `/api/sse/activity`
- 🔲 Race rooms — skapa, gå med via länk, max 8 spelare, ghost-rendering (ingen kollision)
- 🔲 SSE-baserad positionsströmning (20–30Hz, klient-interpolation)
- 🔲 Countdown + live standings under race
- 🔲 Matchmaking — ELO baserat på average percentile, quick match (random official), ranked (veckans rotation)
- 🔲 Vänlista + aktivitetsflöde (SSE: vän slog ditt rekord, ny bana publicerad)
- 🔲 Spelarprofiler — stats, favoritbanor, senaste runs

---

## Beroendeöversikt

```
Fas 1 (Plattform)
├── Fas 2 (Rörelse & Fysik)
│   └── Fas 3 (Gameplay Loop)
│       ├── Fas 4 (HUD & Visuellt)
│       ├── Fas 7 (Avancerad Rörelse)
│       │   └── Fas 8 (Banor) ← kräver även Fas 6
│       │       ├── Fas 9 (Ghost & Replay)
│       │       │   └── Fas 12 (Multiplayer)
│       │       ├── Fas 10 (Map Editor)
│       │       └── Fas 11 (Ljud & Polish)
│       └── Fas 6 (Integration) ← kräver även Fas 5
└── Fas 5 (Backend & Auth)
    └── Fas 6 (Integration)
```

**Parallella spår:**
- Fas 2–4 (frontend/fysik) kan byggas parallellt med Fas 5 (backend)
- Fas 7 (avancerad rörelse) kan börjas så fort Fas 3 är klar
- Fas 4 (HUD) och Fas 7 (mekaniker) är oberoende av varandra
