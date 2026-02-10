# VELOCITY — Gameplay & Content Plan

> Engine-arbete (Fas A, G–N) + grafik (O) + movement (P) + engine-refaktorisering (E) klart.
> Kvar: gameplay mechanics (V), banor (R), multiplayer (T), kodkvalitet/refaktorisering (Q).
> ✅ = klart | 🔲 = kvar | 🔧 = pågår

---

## Fas R — Banor & Content
*En officiell bana ("First Steps"). Map editor v1 komplett. Kvar: editor v2-features.*

**Förutsättning:** Fas O (material/miljö)

### R3 — Map Editor v2
- 🔲 Modell-placering — browse assets/models/, place + scale + rotate i viewport
- 🔲 Texture picker — per-block texture set selection i properties panel
- 🔲 Decoration objects — non-collidable props (pipes, crates, lights, signs)
- 🔲 Terrain brush — heightmap-baserad markyta (smooth/raise/lower/flatten)

---

## Fas T — Multiplayer & Community
*SSE-infrastruktur + race rooms + lobby UI finns (Fas 12 ✅). Kvar: realtidssynk, netcode, ghost rendering, game modes, chat, spectator, anti-cheat.*

**Förutsättning:** Fas 12 (SSE infra) ✅

**Nuläge (befintligt):**
- Backend: SseConnectionManager (singleton, ConcurrentDictionary channels), SSE endpoints (leaderboard, race, activity)
- Backend: RaceRoom/RaceParticipant entities, CQRS handlers (create/join/ready/start)
- Frontend: sseClient.ts (EventSource wrapper, auto-reconnect, typed dispatch)
- Frontend: raceStore.ts (room CRUD, SSE connection, racePositions Map)
- Frontend: RaceLobby → RoomBrowser + RoomLobby + CountdownOverlay
- **Saknas:** Ingen position-streaming under race, ingen ghost-rendering, ingen countdown-timer backend, inget leave/kick, ingen chat

---

### T1 — Realtids Position-Sync (Netcode Grund)
*Spelare skickar position via POST, servern broadcastar till alla i rummet via SSE.*

**Arkitektur:** Client-authoritative med server-relay (SSE). Klienten äger sin physics — servern vidarebefordrar positionsdata utan simulering. Enkel modell som passar speedrunning (alla springer samma bana, ingen PvP-kollision).

**Backend:**
- 🔲 **POST `/api/rooms/{id}/position`** — tar emot `{ position: [x,y,z], yaw, pitch, speed, checkpoint }` från klient
  - Validerar: spelaren är participant, rummet har status Racing
  - Rate-limitat: max 20 req/s per spelare (throttle, inte reject)
  - Broadcastar `position_update` SSE-event till `race:{roomId}` kanalen (exklusive avsändaren)
  - Inkluderar serverns `timestamp` i broadcast (för interpolering)
- 🔲 **Position-batchning** — samla 2-3 positioner och skicka som en batch-SSE-event för att minska overhead
  - `PositionBatcher` service: `ConcurrentDictionary<Guid, PositionSnapshot>` per room
  - Timer (50ms intervall) som broadcastar alla ackumulerade positioner som ett `positions_batch` event
  - Minskar SSE-events från N×20/s till 1×20/s per rum
- 🔲 **Heartbeat** — klient skickar heartbeat var 5:e sekund, server markerar inaktiva spelare efter 15s timeout
  - `LastSeenAt` fält på RaceParticipant (in-memory, ej DB)
  - Broadcast `player_disconnected` event vid timeout

**Frontend:**
- 🔲 **Position sender** — `usePositionSender` hook, skickar position via POST var 50ms (20 Hz)
  - Aktiveras när `raceStore.currentRoom?.status === 'racing'`
  - Läser position/yaw/pitch från playerController refs (ej store)
  - Delta-komprimering: skippa om position ändrats <0.1 units och rotation <0.5°
  - Använder `navigator.sendBeacon` vid tab-close för sista position
- 🔲 **Position receiver** — uppdatera `racePositions` Map från `positions_batch` SSE-event
  - Lagra `{ position, yaw, pitch, speed, checkpoint, timestamp, prevPosition, prevTimestamp }` per spelare
  - Håll 2 senaste snapshots för interpolering
- 🔲 **Interpolering** — smooth remote player movement i renderloop
  - Lerp mellan prevPosition → position baserat på `(now - prevTimestamp) / (timestamp - prevTimestamp)`
  - Clamp faktor till [0, 1.2] — tillåt lite extrapolering vid packet loss
  - Yaw/pitch: slerp med samma faktor

**Kontrakt:**
```typescript
// Frontend → Backend (POST body)
interface PositionUpdate {
  position: [number, number, number];
  yaw: number;
  pitch: number;
  speed: number;
  checkpoint: number; // senast passerade checkpoint-index
}

// Backend → Frontend (SSE batch event)
interface PositionsBatchEvent {
  players: Array<{
    playerId: string;
    playerName: string;
    position: [number, number, number];
    yaw: number;
    pitch: number;
    speed: number;
    checkpoint: number;
    timestamp: number; // server epoch ms
  }>;
}
```

---

### T2 — Ghost Rendering (Remote Players i 3D)
*Visa andra spelare som semi-transparenta "ghosts" i spelvärlden.*

**Engine (`src/engine/`):**
- 🔲 **`engine/effects/GhostPlayer.tsx`** — prop-injected komponent för en remote-spelare
  - Props: `{ position, yaw, pitch, playerName, color, opacity }`
  - Renderar: capsule-mesh (same dims som player collider) + `MeshStandardNodeMaterial` med `opacity` + `transparent: true`
  - Player-namn: `<Html>` (drei) floating label ovanför capsule, alltid face-camera
  - Färg: hash-baserad per `playerId` (deterministisk, unik per session)
- 🔲 **`engine/effects/GhostTrail.tsx`** — valfri trail-effekt bakom ghost
  - GPU line strip: senaste 20 positioner, fading opacity
  - Använder `instancedDynamicBufferAttribute` (befintligt mönster)
  - Toggleable via settingsStore: `showGhostTrails: boolean`

**Game (`src/game/`):**
- 🔲 **`game/components/game/RemotePlayers.tsx`** — wrapper som läser raceStore.racePositions
  - Mappar `racePositions` → array av `<GhostPlayer>` (exkluderar lokal spelare)
  - Applicerar interpolering per frame (engine util)
  - Renderas som child av `<GameScene>` (vid sidan av `<PlayerController>`)
- 🔲 **Viewmodel-vapen på ghost** — (stretch goal, kan skipas V1)
  - Visa simplified weapon mesh på ghost baserat på participant data
  - Kräver weapon-type i position update

**HUD:**
- 🔲 **Minimap/positionsindikator** — visa remote players som prickar relativt till spelaren
  - Engine: `engine/hud/Minimap.tsx` med prop `players: Array<{ position, color, name }>`
  - Game: wrapper läser raceStore → props
  - Valfritt: kompassriktning-pilar utanför skärmkant mot varje ghost

---

### T3 — Race Lifecycle & Countdown
*Fullständig race-flow: countdown → racing → finish → results.*

**Backend:**
- 🔲 **Countdown-timer** — efter `StartRace`, servern skickar `countdown` events: 3→2→1→0
  - Implementera som `Task.Delay`-kedja i handler (fire-and-forget bakgrundsjobb)
  - Event: `{ countdown: 3 }`, sedan 1s delay, `{ countdown: 2 }`, etc.
  - Vid countdown=0: uppdatera room.Status → Racing, broadcast `race_start` (med `raceStartTime` server-timestamp)
  - Alla klienter ska starta sin lokala timer exakt vid `race_start` event
- 🔲 **Finish-rapportering** — POST `/api/rooms/{id}/finish` med `{ finishTime: number }`
  - Validerar: spelaren är participant, status=Racing, inte redan finished
  - Sätter `participant.FinishTime`, broadcastar `player_finished` event
  - Om alla finished: room.Status → Finished, broadcast `race_finished` med resultat
- 🔲 **Leave room** — POST `/api/rooms/{id}/leave`
  - Ta bort participant, broadcast `player_left` event
  - Om host lämnar: nästa participant blir host (äldsta JoinedAt) ELLER stäng rummet om <2 kvar
  - Om under racing: markera som DNF (Did Not Finish)
- 🔲 **Kick-spelare** — POST `/api/rooms/{id}/kick/{playerId}` (host-only)
  - Broadcast `player_kicked` event, ta bort participant
- 🔲 **Room cleanup** — bakgrundstjänst (`IHostedService`) som rensa gamla rum
  - Rum äldre än 30 min med status Waiting → ta bort
  - Rum äldre än 60 min med status Racing → markera Finished (timeout)
  - Kör var 5:e minut

**Frontend:**
- 🔲 **Synkroniserad timer** — `raceStartTime` från server bestämmer T=0
  - Alla klienter räknar `elapsed = Date.now() - raceStartTime`
  - Befintlig speedrun-timer (gameStore) adapterad att använda server-starttid i race-mode
- 🔲 **Finish-logik** — vid målgång, POST finish-time + visa "Waiting for others..."
  - Disable controls efter finish (spectator mode)
  - Visa egen placering i realtid (baserat på checkpoint + finish events)
- 🔲 **Results-skärm** — `RaceResults.tsx` efter alla finished/timeout
  - Sorterad lista: placering, namn, tid, checkpoint-progress
  - Knappar: "Play Again" (skapa nytt rum med samma map), "Back to Lobby"
- 🔲 **Leave-knapp** — tillgänglig i lobby OCH under race (med bekräftelse-dialog under race)

**SSE Events (nya):**
```
race_start       → { raceStartTime: number }          // server epoch ms
player_finished  → { playerId, playerName, finishTime, placement }
player_left      → { playerId, playerName }
player_kicked    → { playerId, playerName }
race_finished    → { results: Array<{ playerId, playerName, finishTime, placement }> }
player_disconnected → { playerId, playerName }
```

---

### T4 — Game Modes
*Olika race-modi med unika regler. Alla bygger på T1-T3 infrastruktur.*

**Gemensamt:**
- 🔲 **Game mode selection** — ny fält `gameMode` på RaceRoom entity + CreateRoomRequest
  - Enum: `TimeAttack | GhostRace | Elimination | Tag | Relay`
  - Visas i RoomBrowser + RoomLobby
  - Mode-specifika regler enforcas i backend handlers

**Time Attack (solo, men med live-leaderboard):**
- 🔲 Solo timed run — befintligt system men som explicit mode
- 🔲 Live position på leaderboard via SSE (leaderboard-kanal)
- 🔲 PB/WR-indikator under run (ahead/behind split-times per checkpoint)

**Ghost Race (race mot sparade replays):**
- 🔲 Ladda ghost-data från replayStore (befintligt delta-komprimerat format)
- 🔲 Visa PB/WR/friends som GhostPlayer i banan
- 🔲 Selection UI: välj vilka ghosts att tävla mot (checkbox-lista)
- 🔲 Kräver inga andra live-spelare — SSE används bara för leaderboard-updates

**Elimination:**
- 🔲 Sista spelaren vid varje checkpoint elimineras
  - Backend trackar checkpoint-order per spelare
  - Vid checkpoint N: om alla passerat → broadcast `player_eliminated` med sista spelaren
  - Eliminerad spelare → spectator mode
- 🔲 Eliminerings-animation: röd flash + "ELIMINATED" text
- 🔲 Spectator: fri kamera som följer kvarvarande spelare

**Tag:**
- 🔲 En spelare börjar som "it" (random vid race_start)
- 🔲 Proximity-check: 3 units → tag transfer (broadcast `tag_transfer` event)
  - Client-side detection, server validerar (båda spelares position nära nog)
- 🔲 "It"-spelare har 10% speed penalty
- 🔲 Timer: spelare ackumulerar tid som "it" — lägst tid vinner
- 🔲 Visuell indikator: "it"-spelaren glöder röd, andra gröna

**Relay:**
- 🔲 2 lag à 2-4 spelare — host tilldelar lag i lobby
- 🔲 Banan delad i sektioner (definieras per checkpoint)
- 🔲 Spelare 1 kör sektion 1 → vid checkpoint: "baton pass" → spelare 2 spawnar
  - Inaktiva spelare ser spectator-vy
- 🔲 Lag-total-tid avgör vinnare

---

### T5 — Chat & Social
*In-game kommunikation och social features.*

- 🔲 **Lobby-chat** — textchat i RoomLobby
  - POST `/api/rooms/{id}/chat` med `{ message: string }` (max 200 tecken)
  - SSE event `chat_message` → `{ playerId, playerName, message, timestamp }`
  - Frontend: `ChatPanel.tsx` komponent i lobby-sidebar
  - Profanity-filter: basic blocklist server-side
- 🔲 **In-race chat** — minimal chat under race (valfritt, kan vara distraherande)
  - Keybind: `T` öppnar chat-input, `Enter` skickar, `Escape` stänger
  - Visas som translucent overlay i övre vänstra hörnet, fade-out efter 5s
- 🔲 **Quick-emotes** — fördefinierade meddelanden via numpad (gg, glhf, nice, wp)
  - Broadcast via samma chat-kanal, visas som popup ovanför ghost

---

### T6 — Spectator Mode
*Titta på pågående races utan att delta.*

- 🔲 **Spectator-join** — POST `/api/rooms/{id}/spectate`
  - Ny roll: spectator (ej participant, syns ej i race)
  - Får alla SSE-events (positions, finish, chat) men skickar inga
- 🔲 **Spectator-kamera** — fri flyg-kamera (WASD + mus) eller follow-cam (click ghost → lock)
  - Engine: `engine/camera/SpectatorCamera.tsx` med prop `{ target?: Vec3, mode: 'free' | 'follow' }`
  - Tab-key cyklar mellan spelare
- 🔲 **Spectator HUD** — visar alla spelares tid, checkpoint, placering
  - Engine: `engine/hud/SpectatorOverlay.tsx` med prop `{ players: SpectatorPlayerInfo[] }`
- 🔲 **Spectator-count** i lobby (visar "3 spectators watching")

---

### T7 — Server-Side Validering & Anti-Cheat (Grundnivå)
*Enkel server-side kontroll — inte fullständig anti-cheat, men rimligt skydd.*

- 🔲 **Speed-validering** — server checkar att rapporterad speed ej överstiger fysisk max (1500 u/s)
  - Om >1500 u/s: flagga spelaren, logga, men blockera ej (kan vara grapple/rocket jump)
  - Om >3000 u/s konsekvent (5+ updates): broadcast `player_flagged` event
- 🔲 **Teleport-detection** — om position hoppar >50 units mellan updates (50ms intervall)
  - Tillåt enstaka hopp (respawn, grapple launch), flagga om det sker >3 gånger
- 🔲 **Finish-time validering** — server jämför `finishTime` mot `raceStartTime`
  - Om finishTime < realistisk minimum (bana-längd / max-speed): reject finish
  - Realistisk minimum: lagras per map som `map.MinExpectedTime` (sätts manuellt)
- 🔲 **Rate limiting per endpoint** — befintligt rate-limiting utökat:
  - Position: 25 req/s (lite marginal över 20 Hz)
  - Chat: 2 req/s
  - Room actions (join/ready/start): 5 req/s
- 🔲 **Replay-validering** (stretch) — vid run-submit, skicka komprimerad replay-data
  - Server kan spela upp offline och verifiera att finish-time matchar physics-sim
  - Kräver headless Rapier på server (framtida, ej V1)

---

### T8 — Multiplayer Polish & UX
*Finputsning av multiplayer-upplevelsen.*

- 🔲 **Connection quality indicator** — visa latency (ms) och connection status i HUD
  - Mät round-trip: timestamp i position POST → server echo i SSE → client diff
  - Visa: grön <100ms, gul 100-200ms, röd >200ms
- 🔲 **Reconnect-hantering** — om SSE tappar anslutning under race:
  - Auto-reconnect (befintligt), men vid reconnect: begär fullständig state-snapshot
  - GET `/api/rooms/{id}/snapshot` — returnerar alla spelares senaste position + room state
  - Smooth transition: interpolera till korrekt state istället för teleport
- 🔲 **Ljud-feedback** — synth-ljud för multiplayer-events:
  - Player joined lobby: kort "pling"
  - Countdown beep: stigande ton 3→2→1→GO
  - Player finished: triumf-fanfar (kort)
  - Player eliminated: dramatisk stinger
- 🔲 **Race-progress bar** — visuell bar som visar alla spelares position längs banan
  - Engine: `engine/hud/RaceProgressBar.tsx`
  - Beräkna progress: `(passerade checkpoints / totala) + (distance till nästa / sektion-längd)`
  - Visa som horisontell bar med färgade prickar per spelare
- 🔲 **Player-lista under race** — kompakt sidebar med placering, namn, tid, checkpoint
  - Sortera efter checkpoint-progress → tid
  - Highlighta lokala spelaren
- 🔲 **"Play Again" flow** — snabb rematch utan att gå via lobby
  - Host klickar "Play Again" → nytt rum med samma map + auto-invite alla
  - Spelare ser popup "Host wants rematch — Join?" med 15s timeout

---

## Fas V — Gameplay Mechanics
*Fördjupa FPS-upplevelsen: ADS, weapon inspect, stances, scope UI, recoil, reload, och mer.*

**Förutsättning:** Fas L (Viewmodel), Fas P (Movement & Game Feel)

### V1 — Aim Down Sights (ADS) ✅
*Generellt ADS-system, inte bara sniper-zoom. Varje vapen får unik ADS-offset.*
- ✅ ADS state machine i usePhysicsTick — adsProgress 0→1 lerp, hold Mouse2
- ✅ FOV-lerp: sniper 30°, assault 55°, shotgun 60°, rocket/grenade/plasma/knife = ingen ADS
- ✅ Viewmodel ADS-position per vapen — offset mot skärmcenter (anchor X→0, Y→-0.1, Z→-0.25)
- ✅ Sensitivity-multiplikator vid ADS (settingsStore: `adsSensitivityMult: 0.7`)
- ✅ Movement speed reduction vid ADS (`ADS_SPEED_MULT: 0.6`)
- ✅ Crosshair fade vid ADS (opacitet → 0 under transition)
- ✅ Alt-fire (Mouse2) håller = ADS, release = hip

### V2 — Sniper Scope Overlay ✅
*Riktig scope-UI ovanpå ADS-systemet. Bara aktiv när sniper + ADS.*
- ✅ `ScopeOverlay.tsx` — fullscreen HUD-element med scope-reticle SVG
- ✅ Scope-vignettering (svart mask runt cirkel, ~70% av skärm)
- ✅ Scope-sway — subtilt drift-mönster kopplat till musrörelser
- ✅ Breath-hold: Shift vid ADS → stabilisera sway 2s (sedan ökat sway)
- ✅ Glint-effekt (lens flare emissive sprite, synlig av andra i multiplayer)
- ✅ Scope unsteadiness ökar med tid: stabilt 0-3s → drift 3-6s → tvinga unscope 6s+

### V3 — Weapon Inspect ✅
*Håll inspect-knapp → vapnet lyfts framför kameran och roteras långsamt.*
- ✅ Keybind: `inspect` (default `F`) i settingsStore
- ✅ Inspect-state i combatStore: `isInspecting: boolean`, `inspectProgress: number`
- ✅ Viewmodel inspect-animation: position → center-screen, rotation → slow Y-axis spin
- ✅ Inspect kräver: inte ADS, inte firing, inte reloading
- ✅ Avbryt inspect automatiskt vid: fire, ADS, weapon switch, damage taken, movement input
- ✅ Kamera-DOF under inspect (bakgrund blurras subtilt)
- ✅ Inspect-ljus — ambient boost i ViewmodelLayer (emissive boost)

### V4 — Stances (Crouch / Prone / Slide) ✅
*Utöka befintligt crouch-system med prone och förbättrad slide.*
- ✅ **Prone (liggande)**
  - Keybind: dubbeltryck `crouch` ELLER dedikerad `prone`-knapp (default `Z`)
  - Capsule-höjd: 0.85 (≥ 2×radius), eye offset: 0.05
  - Max speed: 30 u/s (crawl), no jump, slow stand-up (0.4s)
  - Accuracy boost: `PRONE_SPREAD_MULT: 0.3` (assault/sniper)
  - Entry: crouch → prone (0.3s transition), prone → crouch → stand
  - Jump blocked while prone or transitioning
- ✅ **Slide förbättring**
  - Slide boost: +40 u/s burst vid slide-start
  - Slide-hop: jump under slide behåller momentum + 15 u/s boost
  - Slide duration cap: 1.5s → friction ramp-up (3× after cap)
  - Head-tilt framåt under slide (camera pitch -5°)
  - Slide-ljud (synth whoosh via SOUNDS.SLIDE)
- ✅ **Crouch-jump**
  - Crouch hålls under jump → lägre capsule i luften
  - Tillåter passage genom lägre öppningar
  - Automatisk stand-up vid landing om utrymme finns
- ✅ **Stance-indikator i HUD** — ikon: standing / crouching / prone / sliding

### V5 — Weapon Recoil & Spread ✅
*Kamera-recoil + visuell spread-feedback, inte bara viewmodel-bob.*
- ✅ Recoil-pattern per vapen: vertikal + horisontell offset per skott
  - Assault: litet vertikalt recoil, ackumulerar vid auto-fire, reset 0.3s
  - Sniper: stort engångs-recoil (5° pitch up), snabb recovery
  - Shotgun: brett recoil (2° random), snabb recovery
  - Rocket: minimal (exploision-knockback är feedbacken)
- ✅ Recoil-recovery: kameran återgår automatiskt (lerp mot origin, `RECOIL_RECOVERY_SPEED`)
- ✅ Crosshair bloom: dynamic spread-indikator, expanderar vid fire → krymper vid stasis
- ✅ ADS reducerar recoil: `ADS_RECOIL_MULT: 0.5`
- ✅ Prone reducerar recoil ytterligare: `PRONE_RECOIL_MULT: 0.3`
- ✅ Movement ökar spread: `MOVING_SPREAD_MULT: 1.5` (ground), `AIR_SPREAD_MULT: 2.0`

### V6 — Reload System ✅
*Faktisk reload-mekanik med animation och timing.*
- ✅ Reload-state i combatStore: `isReloading: boolean`, `reloadProgress: number`, `reloadWeapon`
- ✅ Reload-tid per vapen:
  - Assault: 2.0s (mag-baserad)
  - Sniper: 2.5s
  - Shotgun: 0.5s per shell (interruptible)
  - Plasma: 3.0s (full recharge)
  - Rocket: 1.5s
  - Grenade: 1.0s
  - Knife: ingen reload
- ✅ Viewmodel reload-animation: weapon dips down → comes back up
- ✅ Auto-reload vid tom mag (med 0.5s fördröjning)
- ✅ Reload avbryts av: weapon switch, fire (om shells kvar, shotgun), sprint
- ✅ Reload-progress bar i CombatHud (cirkulär runt crosshair)
- ✅ Ammo pickup → direkt till reserve, inte mag
- ✅ Magazine-system för alla vapen (inte bara assault rifle)
- ✅ Reload-ljud (RELOAD_START, RELOAD_FINISH synth-sounds)
- ✅ ADS auto-cancel vid reload, inspect blockeras under reload

### V7 — Headshots & Hitboxes ✅
*Zonbaserad skada med headshot-multiplikator.*
- ✅ Hitbox-zoner: head (×2.5), torso (×1.0), limbs (×0.75)
- ✅ Headshot-indikator: speciell hitmarker (röd ×) + ljud
- ✅ Headshot-streak counter (HUD, fades efter 3s)
- ✅ Raycast hitbox-check via extra collider-shapes på target (head sphere, torso box)
- ✅ Kritisk-skada indikator (>50% hp i ett slag → screen flash röd)

### V8 — Weapon Wheel & Quick-Switch ✅
*Snabbare vapenval utöver 1-7 tangenter.*
- ✅ Weapon wheel: håll `Q` → radialmeny med alla vapen + ammo-status
- ✅ Quick-switch: `Q` tap → senaste vapnet (last weapon toggle)
- ✅ Scroll wheel cyklar vapen (befintligt, wrap-around redan implementerat via modulo)
- ✅ Weapon wheel visar: ikon, namn, ammo, keybind
- 🔲 Slow-mo under wheel (0.3× timescale, bara i singleplayer)

### V9 — Killstreak & Combat Feedback ✅
*Förstärkt stridsfeedback och momentum-känsla.*
- ✅ Killstreak counter: consecutive kills utan att dö → HUD-display (milestones 5/10/15/20/25)
- ✅ Multikill-popup: "Double Kill", "Triple Kill" etc. med timing-fönster (3s)
- ✅ Combo-system: consecutiveHits → pitch-scaling + killstreak-skalad screen shake
- ✅ Hit sound pitch scaling: konsekutiva träffar → stigande pitch (1.0→2.0× över 10 hits)
- ✅ Screen-shake vid kills (skalas med killstreak, headshot-boost)
- ✅ Slow-mo vid run finish (0.3× bullet-time, 200ms duration)

### V10 — Advanced Movement Polish ✅
*Sista finputsningen av movement-systemet.*
- ✅ **Bunny hop timing window**: perfekt timing vid landing → speed boost (+10 u/s, 150ms window)
- ✅ **Speed cap visualization**: HUD-indikator vid >500 u/s (FAST), >800 u/s (HYPER), >1000 u/s (MACH) tier-colors + labels
- ✅ **Dash/dodge**: dubbeltryck strafe → kort burst (100 u/s) med 2s cooldown, 250ms double-tap window
- ✅ **Wall-jump combo**: wall-run → jump → opposite wall-run → jump (chain bonus +20 u/s per chain, max ×5)
- ✅ **Grapple-swing momentum preservation**: release timing påverkar boost (early <0.3s = up, mid = balanced, late >0.6s = forward)
- ✅ **Movement-trail particles**: GhostTrail komponent — synlig trail för ghost replays under runs

---

## Fas Q — Refaktorisering & Kodkvalitet
*Bryt ner komponenter >150 rader, eliminera magic strings, förbättra underhållbarhet.*

**Förutsättning:** Ingen (kan köras parallellt med V/R/T)

### Q1 — PostProcessingEffects.tsx (689 rader)
- ✅ Extrahera effekt-byggare till separata moduler (bloom, SSAO, vignette, fog, etc.)
- ✅ Eliminera magic numbers → `as const` config-objekt
- ✅ Mål: huvudkomponent <150 rader, hooks/builders i egna filer

### Q2 — SettingsScreen.tsx (507 rader)
- ✅ Extrahera varje settings-tab till egen komponent (VideoTab, AudioTab, InputTab, etc.)
- ✅ Eliminera magic strings (tab-namn, labels) → `as const` lookup
- ✅ Mål: huvudkomponent <150 rader, tabs i `components/menu/settings/`

### Q3 — DevLogPanel.tsx (465 rader)
- ✅ Extrahera log-filtrering, perf-bar, och log-rendering till hooks/subkomponenter
- ✅ Eliminera magic strings/numbers → config-objekt
- ✅ Mål: huvudkomponent <150 rader

### Q4 — ExplosionEffect.tsx (426 rader)
- ✅ Extrahera TSL shader-byggare och partikel-logik till egna moduler
- ✅ Eliminera magic numbers (partikel-counts, durations, colors) → `as const`
- ✅ Mål: huvudkomponent <150 rader

### Q5 — MainMenu.tsx (419 rader)
- ✅ Extrahera varje meny-sektion till egen komponent (title, buttons, overlays)
- ✅ Eliminera magic strings → `as const` lookup
- ✅ Mål: huvudkomponent <150 rader

### Q6 — TestMap.tsx (409 rader)
- ✅ Extrahera map-layout data till separat config-fil
- ✅ Extrahera zone-setup, block-generering till hooks
- ✅ Eliminera magic numbers (positioner, storlekar) → map config object
- ✅ Mål: huvudkomponent <150 rader

### Q7 — Övriga komponenter >150 rader (~24 st)
- ✅ Identifiera och lista alla återstående komponenter >150 rader
- ✅ Bryt ner varje till <150 rader via hook-extraktion och subkomponenter
- ✅ Eliminera magic strings/numbers i dessa komponenter
- ✅ Lägg till doc comments (JSDoc) på alla refaktoriserade komponenter

---

## Beroendeöversikt

```
Fas V (Gameplay Mechanics)          ← NY
├── V1 ADS (Aim Down Sights)        beroende: L (Viewmodel)
├── V2 Sniper Scope Overlay          beroende: V1
├── V3 Weapon Inspect                beroende: L (Viewmodel)
├── V4 Stances (Crouch/Prone/Slide)  beroende: P (Movement)
├── V5 Weapon Recoil & Spread        beroende: V1 (ADS multiplicators)
├── V6 Reload System                 beroende: inga
├── V7 Headshots & Hitboxes          beroende: inga
├── V8 Weapon Wheel & Quick-Switch   beroende: inga       ✅
├── V9 Killstreak & Combat Feedback  beroende: inga       ✅
├── V10 Advanced Movement Polish     beroende: V4 (stances), P (movement) ✅

Fas Q (Refaktorisering)              ← NY
├── Q1 PostProcessingEffects (689→<150)  beroende: inga
├── Q2 SettingsScreen (507→<150)         beroende: inga
├── Q3 DevLogPanel (465→<150)            beroende: inga
├── Q4 ExplosionEffect (426→<150)        beroende: inga
├── Q5 MainMenu (419→<150)               beroende: inga
├── Q6 TestMap (409→<150)                beroende: inga
├── Q7 Övriga >150 rader (~24 st)        beroende: inga

Fas R (Banor)
├── R3 Editor v2

Fas T (Multiplayer)                    ← UTÖKAD
├── T1 Realtids Position-Sync          beroende: Fas 12 (SSE infra) ✅
├── T2 Ghost Rendering                 beroende: T1
├── T3 Race Lifecycle & Countdown      beroende: T1
├── T4 Game Modes                      beroende: T2, T3
├── T5 Chat & Social                   beroende: T1 (SSE)
├── T6 Spectator Mode                  beroende: T2, T3
├── T7 Anti-Cheat                      beroende: T1
├── T8 Multiplayer Polish              beroende: T2, T3, T5

Parallellism:
  V1+V3+V6+V7+V8+V9 kan alla starta parallellt
  V2 väntar på V1 (ADS krävs för scope)
  V4 och V10 kan starta parallellt med V1
  V5 bör komma efter V1 (ADS-recoil-multiplikator)
  Q kan köras helt parallellt med V, R och T (inga beroenden)
  R, T och V kan köras parallellt (inga beroenden emellan)
  T1 kan starta direkt (bygger på befintlig Fas 12 infra)
  T2 + T3 kan köras parallellt efter T1
  T4 + T5 + T6 kan starta efter T2/T3
  T7 kan starta efter T1 (oberoende av T2-T6)
  T8 sist (polish, kräver allt annat)
```

---

<details>
<summary>Arkiv — Klara faser (A, E, Engine Extraction, G–P, Fas 12)</summary>

## Fas A — Asset Pipeline & glTF Loading ✅
- ✅ A1 glTF Model Loader (GLTFLoader + DRACOLoader)
- ✅ A2 PBR Texture System (loadTexture, loadTextureSet, useTexturedMaterial)
- ✅ A3 HDRI Skybox (RGBELoader, PMREMGenerator, per-map config)
- ✅ A4 Asset Downloads CC0 (Quaternius, Kenney, Poly Haven, 3dtextures, ambientCG)

## Engine Extraction ✅
- ✅ Core, Physics, Input, Audio, Effects, Stores, Types → `src/engine/`
- ✅ Barrel exports, CLAUDE.md engine/game boundary rules

## Fas G — GPU Performance & Memory ✅
- ✅ G1 Collider Merging (batchStaticColliders)
- ✅ G2 ModelBlock Dispose & Cache Eviction
- ✅ G3 DynamicPointLights → TSL Sprites (GpuLightSprites)
- ✅ G4 Spatial Partitioning (SpatialGrid + useSpatialCulling)
- ✅ G5 LOD (LodManager, InstancedBlocks dual-mesh)

## Fas H — Camera, Interaction & Rendering ✅
- ✅ H1 RTS Camera (useRtsCamera + useRtsInput)
- ✅ H2 GPU Picking (GpuPicker + usePickable)
- ✅ H3 SurfRamp Instancing
- ✅ H4 Snap-to-Grid

## Fas I — Atmosphere & D&D Systems ✅
- ✅ I1 Clustered TSL Lighting (tile clustering, 512 lights, Frostbite PBR)
- ✅ I2 Fog of War (GPU compute ray march)
- ✅ I3 Physical Dice (Rapier dynamic bodies)

## Fas J — Animation & Asset Upgrade ✅
- ✅ J1 Animation Extraction (animationCache, loadModelWithAnimations)
- ✅ J2 Animation Playback Hook (useAnimation)
- ✅ J3 Animated Object Component (AnimatedModel)

## Fas K — Shadows & Lighting Quality ✅
- ✅ K1 Directional Shadow (CSM, useShadowLight)
- ✅ K2 Shadow Quality Settings (4 presets, settingsStore)

## Fas L — Viewmodel & First-Person Rendering ✅
- ✅ L1 Viewmodel Render Layer (createPortal, separate camera)
- ✅ L2 Viewmodel Animation (idle sway, bob, recoil, draw/holster)
- ✅ L3 Muzzle Flash (GPU sprite burst, emissive ×8)

## Fas M — Post-Processing Pipeline ✅
- ✅ M1 SSAO (inline TSL, 8-sample spiral)
- ✅ M2 Color Grading & Film Effects (exposure, contrast, saturation, grain, chromatic)
- ✅ M3 PostFX Settings (quality preset mapping)

## Fas N — Decals & Particle Variety ✅
- ✅ N1 Decal System (64-pool, ring-buffer, instancedDynamicBufferAttribute)
- ✅ N2 Particle Presets (8 types: smoke, sparks, dust, debris, trail, snow, ash, pollen)
- ✅ N3 Environmental Particles (GPU compute, camera-follow, wind)

## Fas O — Grafik & Visuell Polish ✅
- ✅ O1 Material Upgrade (PBR per-block, emissive, texture blending)
- ✅ O2 Miljöeffekter (vatten/lava, volumetrisk dimma, rök/eld-emitters)
- ✅ O3 Motion Blur & DoF (velocity reconstruction, bokeh DoF, settings)

## Fas P — Movement & Game Feel ✅
- ✅ P1 Weapon Movement Mechanics (rocket jump, shotgun jump, plasma surf, grenade boost)
- ✅ P2 Hit Feedback & Game Feel (hit marker, wall sparks, kill feed, damage numbers)
- ✅ P3 Edge Grab & Mantling (edge detection, mantle animation, settings toggle)

## Fas 12 — Multiplayer & SSE ✅
- ✅ Backend SSE endpoints (leaderboard, race, activity)
- ✅ Race rooms API (create, join, ready, start)
- ✅ Frontend SSE client (auto-reconnect)
- ✅ Race store + lobby UI (RoomBrowser, RoomLobby, CountdownOverlay)

## Fas E — Engine Refaktorisering ✅
- ✅ E1 HUD → engine/hud/ (14 komponenter, prop injection)
- ✅ E2 Stores → engine/stores/ (settingsStore, replayStore, editorStore)
- ✅ E3 SensorZone → engine/components/ (9 zoner + generisk bas)
- ✅ E4 Konfigurerbar Effects (GpuProjectiles, particles, MuzzleFlash, viewmodel anim)
- ✅ E5 Rendering & Environment → engine/effects/ (skybox, fog, vatten, particles, trails)
- ✅ E6 Cleanup & Map Renderers (InstancedBlocks, SurfRamps, Terrain, ModelBlock → engine/rendering/)

</details>
