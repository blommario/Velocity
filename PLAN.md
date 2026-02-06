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
- ✅ Checkpoint-räknare — "CP 3/7" uppe till höger
- ✅ Split-tider — popup vid checkpoint (+/- vs PB, grön/röd)
- ✅ Track progress bar — tunn bar längst ner
- ✅ FOV-skalning — 90° bas → 110° vid 400 u/s → 120° vid 800+ u/s (smooth lerp)
- ✅ Speed lines — subtila radiella linjer vid höga hastigheter (canvas overlay)
- ✅ Screen shake — infrastruktur klar (triggerShake/clearShake i gameStore, ScreenShake komponent)
- 🔲 Crosshair — customization (färg, stil, size) i settings

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
- ✅ `RunRepository`-implementation + `ILeaderboardRepository` + `LeaderboardRepository`
- ✅ `RunHandler` + `RunEndpoints` — `POST /api/runs`, `GET /api/runs/{id}`, `GET /api/runs/map/{mapId}`
- ✅ `LeaderboardHandler` + `LeaderboardEndpoints` — `GET /api/maps/{mapId}/leaderboard`
- ✅ Maps CRUD: `PUT /api/maps/{id}`, `DELETE /api/maps/{id}` (author-only)
- ✅ Maps like: `POST /api/maps/{id}/like`
- ✅ Spelprofiler: `GET /api/players/{id}/profile`

---

## Fas 6 — Frontend ↔ Backend Integration
*Koppla ihop spelet med API:et.*

**Förutsättning:** Fas 3 (gameplay loop) + Fas 5 (backend endpoints)

- ✅ Auth-flow i frontend — guest-login vid start, token i Zustand/localStorage
- ✅ `authStore` — token, player info, login/register/guest actions + session restore
- ✅ Skicka run till backend vid slutförd bana (tid, stats, auto-submit i EndRunModal)
- ✅ Hämta leaderboard per bana och visa i UI (EndRunModal visar top 10)
- ✅ Hämta bandata (MapDataJson) från backend och rendera i R3F (MapLoader + GameCanvas integration)
- ✅ Main Menu — banlista hämtad från API med filter/sökning + AuthScreen

---

## Fas 7 — Avancerad Rörelse
*Nya mekaniker. Kräver att basrörelse + gameplay loop fungerar.*

**Förutsättning:** Fas 3 (gameplay loop — för att testa mekanikerna på riktiga banor)

### 7a — Vapen & Explosioner
- ✅ Raketgevär — projektil (900 u/s), explosion vid impact (combatStore + useAdvancedMovement)
- ✅ Rocket jump — knockback baserat på avstånd, 50% self-damage (applyExplosionKnockback)
- ✅ Granater — arc-fysik, gravity, 2.5s fuse timer (combatStore updateProjectiles)
- ✅ Grenade jump — timing + knockback (delar explosion-logik med raket)
- ✅ Ammo-system — begränsad ammo per bana, AmmoPickup komponent + pickupAmmo action
- ✅ Health-system — self-damage + regeneration (takeDamage, regenTick, 3s delay + 15 hp/s)
- 🔲 Sniper rifle — hitscan, hög precision, ingen knockback
- 🔲 Rifle — hitscan, låg precision, liten knockback
- 🔲 Machine gun — hitscan, hög eldhastighet, liten knockback
- 🔲 Knife — melee, ingen knockback

### 7b — Rörelse-mekaniker
- ✅ Wall running — väggdetektion + strafe key, 1.5s max, 90% speed preservation, wall jump
- ✅ Surfing — vinklade ytor (30–60°), noll friktion, gravity-driven (isSurfSurface + applySurfPhysics)
- ✅ Boost pads — instant velocity-addition i fast riktning (BoostPad komponent + applyBoostPad)
- ✅ Launch pads — vinklade boost pads, ersätter velocity (LaunchPad + applyLaunchPad)
- ✅ Speed gates — 1.5x speed multiplier vid >400 u/s (SpeedGate + applySpeedGate)

### 7c — Grappling Hook
- ✅ Hook fäster vid GrapplePoint-komponenter (E-tangent)
- ✅ Pendel-fysik (applyGrappleSwing — pull force + constrained to rope length)
- ✅ Momentum transfer vid release (GRAPPLE_RELEASE_BOOST multiplicator)

---

## Fas 8 — Banor
*Riktiga banor kräver att alla mekaniker finns + bandata kan laddas.*

**Förutsättning:** Fas 7 (alla mekaniker) + Fas 6 (map loading från API)

- ✅ MapData JSON-format — TypeScript interfaces i `map/types.ts` (Vec3, MapBlock, alla game objects, settings, lighting)
- ✅ Map loader — `MapLoader.tsx` parsar MapData → R3F (BlockRenderer, MovingPlatformRenderer, alla zoner)
- ✅ **"First Steps"** (Easy) — Tutorial: korridorer, kurvor, gap jumps, bhop corridor. Par: 45s
- ✅ **"Cliffside"** (Medium) — Klippor, klippstigar, stenbroar. Surf ramps, rocket jump shortcuts. Hemlig grotta. Par: 90s
- ✅ **"Neon District"** (Medium) — Cyberpunk-stad, neonljus, glasyta. Wall running, speed gates, boost pads. Par: 75s
- ✅ **"The Gauntlet"** (Hard) — Industriell/mekanisk, rörliga plattformar, vertical shaft. Alla mekaniker. Par: 120s
- ✅ **"Skybreak"** (Expert) — Flytande öar, tunna broar, grapple points. Surf + rocket jumps. Par: 180s

---

## Fas 9 — Ghost & Replay
*Kräver att banor kan spelas och runs sparas.*

**Förutsättning:** Fas 6 (run submission) + Fas 8 (spelbara banor)

- ✅ Replay-inspelning — position + rotation vid ~30Hz (downsampled från 128Hz), delta-komprimering med keyframes var 32:e frame
- ✅ Replay-lagring på backend (`POST /api/runs/{runId}/replay`, `GET /api/runs/{runId}/replay`)
- ✅ Ghost-rendering — semi-transparent blå kapsel som följer replay-data med binärsökning + interpolation
- ✅ Race mot ghost — PB auto-sparas som ghost vid finishRun, WR ghost laddas via leaderboard "Race WR"-knapp
- ✅ Download/streaming av replay-data — replayService (submitReplay, getReplay), EndRunModal auto-submits replay efter run

---

## Fas 10 — Map Editor
*Kräver att MapData-formatet finns + API för att spara.*

**Förutsättning:** Fas 8 (map format definierat)

- ✅ Editor-layout: vänster = objektpalett, höger = egenskaper, topp = toolbar, 3D viewport (MapEditor + EditorToolbar + ObjectPalette + PropertiesPanel)
- ✅ Fri kamera — WASD + högerklick-drag (fly mode, Shift=snabb, Space/Q=upp/ner)
- ✅ Block placement — snap-to-grid, cubes, ramps, cylindrar (klick på ground plane)
- ✅ Material/textur-väljare — color picker, emissive, transparency, opacity i PropertiesPanel
- ✅ Objekt-palett — alla objekttyper grupperade: geometry, zones, pads, items, dynamic
- ✅ Transform controls — G (move), R (rotate), S (scale) + drei TransformControls + snap
- ✅ Moving platforms — waypoint-editor med add/edit per waypoint + speed/pauseTime
- ✅ Lighting presets — Day, Sunset, Night, Neon
- ✅ Test play — Tab för att växla editor ↔ playtest (renderar GameCanvas med exporterad MapData)
- ✅ Undo/redo — full historik-stack (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z), max 50 steg
- ✅ Copy/paste — Ctrl+D duplicerar valt objekt, Delete/Backspace raderar
- ✅ Spara/ladda/publicera — SavePublishModal: publicera till backend, save/load JSON lokalt, Ctrl+S
- ✅ Auto-validering — validate() kollar finish zone, checkpoint-sekvens, minst ett block
- 🔲 Community browser — rating, tags (difficulty, style), sökning

---

## Fas 11 — Ljud & Polish
*Förhöjer upplevelsen. Kräver att spelet är spelbart.*

**Förutsättning:** Fas 8 (spelbar bana med mekaniker)

- ✅ Fotsteg — syntetiserade ljud, varierar per yta (sten/metall/glas), hastighetsbaserat tempo (AudioManager)
- ✅ Hopp/landning — jump + land_soft/land_hard (skalat efter fallhöjd) i usePhysicsTick
- ✅ Raket — rocket_fire + rocket_explode med bas (synth med sawtooth + lowpass filter)
- ✅ Granat — grenade_throw + grenade_explode syntetiserade ljud
- ✅ Grappling hook — grapple_attach + grapple_release
- ✅ Boost/speed gate — boost_pad, launch_pad, speed_gate elektroniska ljud
- ✅ Checkpoint ding + finish fanfare — checkpoint + finish i zone-komponenter
- 🔲 Ambient — per-bana (vind, stadsljud, mekaniskt) — kräver riktiga ljudfiler
- ✅ Settings-meny (SettingsScreen med tabs):
  - ✅ Mus-sensitivity slider
  - ✅ FOV-slider (80–130)
  - ✅ Keybindings (fullt rebindable med klick-to-rebind)
  - ✅ Ljud: master, SFX, musik, ambient volymsliders
  - ✅ Grafik: quality presets (Low/Med/High/Ultra), shadows, particles, speed lines, screen shake toggles
  - ✅ HUD: toggle individuella element, skala, opacity
  - ✅ Gameplay: auto-bhop toggle, crosshair-stil/färg/storlek
- ✅ Settings persistens — Zustand `persist` middleware sparar alla settings i localStorage

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
- 🔲 pvp-läge — direkt duell med real-time positionsdata, ingen ghost-rendering, collision enabled, power-ups (boosts, mines)
- 🔲 teams — 2v2 eller 4v4, lagbaserade mål (först till X poäng), lag-chat
- 🔲 olika game modes — time attack, elimination (sista spelaren kvar), capture the flag (kontrollpunkter)
- 🔲 Rankingsystem — global leaderboard + per-map, med pagination och filter (friends, region)

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
