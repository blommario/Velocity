# VELOCITY — Gameplay & Content Plan

> Engine-arbete (Fas A, G–N) + grafik (O) + movement (P) + engine-refaktorisering (E) klart.
> Kvar: gameplay mechanics (V), kamera FPS/TPS (C), banor (R), multiplayer (T), kodkvalitet/refaktorisering (Q).
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
*Bleeding edge multiplayer: WebSocket + binärt protocol + room sharding. Mål: 10,000+ samtidiga spelare per server.*

**Förutsättning:** Fas 12 (SSE infra) ✅ — ersätts av WebSocket i T0

**Nuläge (befintligt):**
- Backend: SseConnectionManager (singleton, ConcurrentDictionary channels), SSE endpoints (leaderboard, race, activity)
- Backend: RaceRoom/RaceParticipant entities, CQRS handlers (create/join/ready/start)
- Frontend: sseClient.ts (EventSource wrapper, auto-reconnect, typed dispatch)
- Frontend: raceStore.ts (room CRUD, SSE connection, racePositions Map)
- Frontend: RaceLobby → RoomBrowser + RoomLobby + CountdownOverlay
- **Problem med SSE:** Enkelriktad (server→klient), JSON-only, ~400 bytes headers per POST, max 6 connections/origin (H1), ingen ping/pong, ingen binär data

**Designbeslut:**
- **Transport:** WebSocket (native i ASP.NET Core + alla browsers, 0 nya dependencies)
- **Protocol:** Binärt (ArrayBuffer) för positionsdata (29 bytes vs ~180 bytes JSON = 6× mindre)
- **Kontrollmeddelanden:** JSON över samma WebSocket (lobby events, chat, lifecycle)
- **Server-modell:** Room-sharded — varje rum kör isolerad broadcast-loop, System.Threading.Channels för lock-free I/O
- **Klient-modell:** Client-authoritative med server-relay (ingen server-physics), heuristisk anti-cheat
- **Framtidssäkring:** Abstraktionslager (`IGameTransport`) som tillåter WebTransport-backend senare (QUIC/UDP)

---

### T0 — WebSocket Transport Layer (SSE-ersättning)
*Byt ut SSE + POST med en enda WebSocket-anslutning per spelare. Noll nya dependencies.*

**Arkitekturöversikt:**
```
Browser                          ASP.NET Core (Kestrel)
───────                          ──────────────────────
GameTransport                    WebSocket middleware
  ├─ connect(roomId, token)      ├─ JWT-validering vid upgrade
  ├─ send(binary | json)         ├─ RoomManager (singleton)
  ├─ onMessage(handler)          │   └─ Room (per rum, isolerad)
  ├─ onClose(handler)            │       ├─ Channel<ReadOnlyMemory<byte>> inbound
  └─ disconnect()                │       ├─ PlayerSocket[] (WebSocket refs)
                                 │       ├─ PositionBuffer[] (pre-allokerat)
                                 │       ├─ BroadcastLoop (20Hz bakgrundsuppgift)
                                 │       └─ HeartbeatMonitor (5s intervall)
                                 └─ AntiCheatValidator (per-room)
```

**Backend — WebSocket Endpoint:**
- 🔲 **`/ws/race/{roomId}`** — WebSocket upgrade endpoint
  - JWT-validering: token som query-param vid upgrade (samma som SSE idag), validera claims
  - Vid accept: `RoomManager.JoinRoom(roomId, playerId, webSocket)`
  - Vid close/error: `RoomManager.LeaveRoom(roomId, playerId)` + broadcast `player_left`
  - Kestrel inbyggt: `app.UseWebSockets()` + `context.WebSockets.AcceptWebSocketAsync()`
  - **Inga nya NuGet-paket** — allt inbyggt i `Microsoft.AspNetCore.WebSockets`

- 🔲 **`RoomManager`** — singleton, äger alla aktiva rum
  - `ConcurrentDictionary<Guid, Room>` — skapas vid första join, tas bort när tomt
  - `JoinRoom(roomId, playerId, ws)` → skapa Room om ej finns, lägg till spelare
  - `LeaveRoom(roomId, playerId)` → ta bort spelare, stäng rum om tomt
  - Exponerar `GetRoomSnapshot(roomId)` för reconnect-scenario

- 🔲 **`Room`** — isolerad per race-rum, egen bakgrundsuppgift
  - `PlayerSocket[]` — pre-allokerat array (maxPlayers), håller WebSocket + playerId + metadata
  - `PositionBuffer[]` — pre-allokerat, en `PositionSnapshot` struct per spelare-slot
  - Inbound: receive-loop per spelare → skriver till `Channel<InboundMessage>` (bounded: 256)
  - `BroadcastLoop` — kör som `Task.Run`, 20Hz tick (50ms):
    1. Läs alla positioner från PositionBuffer (dirty-flag)
    2. Serialisera till binär batch (se protocol nedan)
    3. `Task.WhenAll(players.Select(p => p.Socket.SendAsync(batch)))` — parallell broadcast
    4. Reset dirty-flags
  - `ProcessInbound` — kör som `Task.Run`, drain Channel kontinuerligt:
    1. Binary message → deserialisera position → skriv till PositionBuffer[slot]
    2. JSON message → parsa → dispatcha (chat, ready, finish, etc.)
  - `HeartbeatMonitor` — var 5:e sekund: check `LastSeenAt` per spelare, kick vid 15s timeout

- 🔲 **Graceful shutdown** — `IHostedService` som stänger alla rum vid app-stopp
  - Skicka `server_shutdown` meddelande → close alla WebSockets med 1001 (Going Away)

**Backend — Behåll REST för lobby (icke-realtid):**
- Room CRUD (create/list/get) förblir REST — ingen realtidsdata
- Join/leave/ready/start → kan köras via REST ELLER via WebSocket JSON-meddelande
- SSE endpoints (`/api/sse/leaderboard`, `/api/sse/activity`) behålls för icke-rum-data (låg frekvens)

**Frontend — Transport Abstraction:**
- 🔲 **`engine/networking/GameTransport.ts`** — interface + WebSocket-implementation
  ```typescript
  interface IGameTransport {
    connect(url: string, token: string): Promise<void>;
    sendBinary(buffer: ArrayBuffer): void;
    sendJson<T>(type: string, data: T): void;
    onBinary(handler: (buffer: ArrayBuffer) => void): void;
    onJson<T>(type: string, handler: (data: T) => void): void;
    onClose(handler: (code: number, reason: string) => void): void;
    disconnect(): void;
    readonly state: 'connecting' | 'open' | 'closed';
    readonly latencyMs: number;
  }
  ```
  - WebSocket-implementation: native `WebSocket` API
  - Auto-reconnect: exponential backoff (1s → 2s → 4s → 8s → 16s max), max 10 försök
  - Ping/pong: skicka ping var 5s, mät RTT, exponera `latencyMs`
  - Message framing: första byte = 0x00 → binär position, 0x01 → JSON UTF-8

- 🔲 **Migrera `sseClient.ts` → `GameTransport`**
  - `raceStore.connectToRace(roomId)` → `transport.connect('/ws/race/' + roomId, token)`
  - SSE event handlers → `transport.onJson('countdown', ...)`, `transport.onBinary(...)`
  - `sseClient.ts` behålls BARA för leaderboard/activity (låg-frekvens SSE)

**Binärt Positions-Protocol (29 bytes per spelare):**
```
Offset  Size  Field              Encoding
──────  ────  ─────              ────────
0       1     msgType            0x01 = position_update
1       1     playerSlot         uint8 (0-31, index i rummet)
2       4     posX               float32 LE
6       4     posY               float32 LE
10      4     posZ               float32 LE
14      2     yaw                int16 LE (rad × 10000, ger ~0.0001 rad precision)
16      2     pitch              int16 LE (rad × 10000)
18      2     speed              uint16 LE (u/s × 10, max 6553.5 u/s)
20      1     checkpoint         uint8 (0-255)
21      4     timestamp          uint32 LE (server ms offset från race start, max ~49 dagar)
─── Total: 25 bytes per spelare

Batch-format (server → klient):
[1 byte msgType=0x02][1 byte playerCount][25 bytes × N]
= 2 + 25N bytes totalt
= 202 bytes för 8 spelare (vs ~1440 bytes JSON = 7× mindre)
```

**Frontend — Binär Serializer:**
- 🔲 **`engine/networking/PositionCodec.ts`** — encode/decode med DataView
  - `encodePosition(pos, yaw, pitch, speed, checkpoint): ArrayBuffer` (klient → server)
  - `decodeBatch(buffer: ArrayBuffer): PositionSnapshot[]` (server → klient)
  - Använder pre-allokerad `ArrayBuffer` + `DataView` — noll GC per frame
  - Quantized rotation: `int16(yaw * 10000)` → ~0.006° precision (osynlig skillnad)

---

### T1 — Room Lifecycle & Server-Driven Race Flow
*Fullständig race-flow via WebSocket: countdown → racing → finish → results.*

**Backend:**
- 🔲 **Countdown-sekvens** — `Room.StartCountdown()` kör som bakgrundsuppgift:
  - Broadcast JSON: `{ type: "countdown", value: 3 }` → 1s delay → `{ value: 2 }` → etc.
  - Vid value=0: `room.Status = Racing`, broadcast `{ type: "race_start", raceStartTime: <epoch ms> }`
  - `raceStartTime` är serverns klocka — alla klienter synkar mot denna
  - Room.BroadcastLoop aktiveras först vid `race_start` (ingen position-streaming under countdown)

- 🔲 **Finish-rapportering** — klient skickar JSON via WebSocket: `{ type: "finish", finishTime: <ms since raceStart> }`
  - Server validerar: `finishTime > 0`, spelaren ej redan finished, status=Racing
  - Server beräknar placering (ordning bland finished-spelare)
  - Broadcast `{ type: "player_finished", playerId, playerName, finishTime, placement }`
  - Om alla finished ELLER timeout (5 min): `room.Status = Finished`, broadcast `race_finished`
  - Spara resultat till DB (`RaceResult` entity) för leaderboard/historik

- 🔲 **Leave/Kick** — via WebSocket JSON eller REST
  - Leave: `{ type: "leave" }` → server tar bort spelare, broadcast `player_left`
  - Kick (host): `{ type: "kick", targetPlayerId }` → validera host, broadcast `player_kicked`
  - Host-succession: äldsta kvarvarande → ny host, broadcast `host_changed`
  - Under racing: leave → DNF (registreras i resultat)
  - WebSocket close event → implicit leave (ingen explicit leave behövs vid tab-close)

- 🔲 **Room cleanup** — `RoomCleanupService : IHostedService`
  - Var 60:e sekund: iterera `RoomManager.GetAllRooms()`
  - Waiting >30 min utan aktivitet → stäng rum + disconnect alla
  - Racing >10 min → force-finish (broadcast timeout + resultat)
  - Finished >2 min → ta bort rum från minne

- 🔲 **RaceResult entity** — persistera race-resultat till DB
  - `RaceResult { Id, RoomId, MapId, PlayerId, FinishTime?, Placement, GameMode, CreatedAt }`
  - Möjliggör historik, stats, och matchmaking-data

**Frontend:**
- 🔲 **Synkroniserad timer** — vid `race_start` event: lagra `raceStartTime` i raceStore
  - Timer: `elapsed = Date.now() - raceStartTime` (uppdateras i requestAnimationFrame)
  - Clock-offset-kalibrering: vid WebSocket-connect, klient skickar `{ type: "ping", t: Date.now() }`
    → server svarar `{ type: "pong", t: clientT, serverT: Date.now() }` → klient beräknar offset
  - `correctedNow = Date.now() + clockOffset` — ger ~5ms precision
- 🔲 **Finish-flow** — vid checkpoint = final: skicka finish via transport
  - Visa "Waiting for others..." overlay med placering + resultat-lista
  - Disable controls (pointerlock release), byt till spectator-cam
- 🔲 **Results-skärm** — `RaceResults.tsx` (game/components/menu/race/)
  - Sorterad: placering, namn, tid (mm:ss.ms), delta vs vinnare
  - Knappar: "Play Again" (host skapar nytt rum) + "Back to Lobby"
  - Progression: XP/ELO-change (om ranking-system implementeras)
- 🔲 **Leave/disconnect UX** — leave-knapp i lobby + under race (bekräftelse-dialog)
  - Transport.onClose → visa "Disconnected" overlay med retry-knapp

---

### T2 — Ghost Rendering (Remote Players i 3D)
*Instanced rendering av alla remote-spelare — 1 draw call oavsett antal.*

**Engine (`src/engine/`):**
- 🔲 **`engine/effects/InstancedGhosts.tsx`** — renderar ALLA ghosts med en enda instanced mesh
  - Props: `{ ghosts: GhostData[], localPlayerId: string }`
  - `GhostData = { position, yaw, pitch, color, slot }`
  - Capsule-geometri (CapsuleGeometry), instanced via `InstancedMesh` (max 32 instanser)
  - Per-instance: transform matrix (position + rotation) + color attribute
  - `MeshStandardNodeMaterial` med per-instance `color` via `instanceColor` + `opacity: 0.7`
  - **1 draw call** oavsett antal ghosts (vs N draw calls med individuella meshes)
  - useFrame: uppdatera `instanceMatrix` + `instanceColor` varje frame (mutate, inte recreate)

- 🔲 **`engine/effects/GhostNameplates.tsx`** — GPU-renderade namnplattor (inte DOM `<Html>`)
  - Instanced `SpriteNodeMaterial` med text → canvas texture atlas
  - Pre-render alla spelares namn till en texture atlas vid join (max 32 namn × 128px = 4096px texture)
  - Sprite per ghost: `instancedDynamicBufferAttribute` för position (billboard ovanför capsule)
  - **0 DOM-element** — kritiskt för skalning (drei `<Html>` skapar 1 DOM-nod per ghost)

- 🔲 **`engine/effects/GhostTrail.tsx`** — instanced trail-rendering
  - Ringbuffer: 32 spelare × 20 trail-positioner = 640 points
  - `instancedDynamicBufferAttribute` för position + opacity
  - `LineBasicNodeMaterial` med per-vertex alpha fade
  - Toggleable via settingsStore: `showGhostTrails: boolean`
  - **1 draw call** för alla trails

- 🔲 **`engine/networking/Interpolation.ts`** — pure function, inga React-dependencies
  - `interpolatePosition(prev, curr, t): Vec3` — lerp med clamp [0, 1.5]
  - `interpolateRotation(prevYaw, currYaw, t): number` — shortest-arc lerp
  - `calculateInterpolationT(prevTimestamp, currTimestamp, now): number`
  - Extrapolering vid packet loss: om `t > 1.0`, använda velocity × (t - 1.0) × dt
  - Exportera från `engine/networking/index.ts`

**Game (`src/game/`):**
- 🔲 **`game/components/game/RemotePlayers.tsx`** — thin wrapper
  - Selector: `useRaceStore(s => s.racePositions)` (shallow compare)
  - Per frame (useFrame): interpolera alla positioner → mata `<InstancedGhosts>` + `<GhostNameplates>`
  - Exkluderar lokal spelares slot
  - Renderas i GameScene vid sidan av PlayerController

**HUD:**
- 🔲 **`engine/hud/RacePositionIndicator.tsx`** — pilar mot off-screen ghosts
  - Props: `{ players: Array<{ screenPos, isOnScreen, direction, distance, color, name }> }`
  - Pilar vid skärmkant som pekar mot ghosts utanför viewport
  - Distance-label (50m, 120m etc.)
  - Beräkning i useFrame: project ghost world-pos → NDC → screen

---

### T3 — Chat & Social (via WebSocket)
*All chat körs via samma WebSocket-anslutning — inga extra connections.*

- 🔲 **Lobby-chat** — JSON via transport: `{ type: "chat", message: string }`
  - Server validerar: max 200 tecken, rate limit 2 msg/s per spelare, basic profanity-filter
  - Broadcast: `{ type: "chat_message", playerId, playerName, message, timestamp }`
  - Frontend: `ChatPanel.tsx` i RoomLobby sidebar — scrollbar list, input fält
  - Behåll senaste 100 meddelanden i raceStore
- 🔲 **In-race chat** — samma protocol, minimal UI
  - Keybind: `T` → öppna chat-input (pausar inte spelet, släpper inte pointerlock)
  - `Enter` → skicka, `Escape` → stäng input
  - Meddelanden visas som fade-out overlay (5s) i övre vänstra hörnet
  - Max 5 synliga meddelanden, äldre skrollar bort
- 🔲 **Quick-emotes** — fördefinierade meddelanden
  - `{ type: "emote", emoteId: number }` — 8 emotes (gg, glhf, nice, wp, lol, rip, ez, brb)
  - Visas som bubble ovanför ghost-capsule (sprite, 2s fade)
  - Keybind: radial menu (håll `V`) eller numpad 1-8

---

### T4 — Game Modes
*Alla modes körs via samma WebSocket-transport. Server enforcas mode-regler i Room.*

**Gemensamt:**
- 🔲 **`GameMode` enum** — `Race | TimeAttack | GhostRace | Elimination | Tag | Relay`
  - Nytt fält på `RaceRoom` entity + `CreateRoomRequest`
  - `Room` class dispatchar till mode-specifik `IGameModeHandler`
  - Frontend: mode-val i room-create dialog, visas i RoomBrowser

- 🔲 **`IGameModeHandler` interface** (backend):
  ```csharp
  interface IGameModeHandler {
    void OnPlayerJoined(Room room, PlayerSocket player);
    void OnPositionUpdate(Room room, int slot, PositionSnapshot pos);
    void OnCheckpointReached(Room room, int slot, int checkpoint);
    void OnPlayerFinished(Room room, int slot, float finishTime);
    ValueTask<byte[]?> GetCustomBroadcast(Room room); // mode-specific batch data
  }
  ```

**Race (default):**
- Standard tävlingsläge — alla springer samma bana, först till mål vinner
- Inga extra regler utöver T1 lifecycle

**Time Attack (solo med live-leaderboard):**
- 🔲 Solo — room med maxPlayers=1, bara spelare vs klockan
- 🔲 Live leaderboard: vid finish → broadcast till `leaderboard:{mapId}` SSE-kanal
- 🔲 Split-times per checkpoint: jämför mot PB/WR i realtid
  - Server lagrar checkpoint-split-times per map+player i `SplitTime` entity
  - Klient visar delta: "+1.23" (röd) eller "-0.45" (grön) vid varje checkpoint

**Ghost Race (race mot replays):**
- 🔲 Ladda ghost-data: GET `/api/replays/{mapId}/ghosts?type=pb,wr,friends`
  - Returnerar komprimerade replay-data (befintligt delta-format från replayStore)
- 🔲 Frontend: avkoda replay → spela upp som GhostData i InstancedGhosts
  - Replay-ghosts renderas identiskt med live-ghosts (samma instanced pipeline)
  - Replay-interpolering: exakt tidsstämplar (ej nätverks-jitter)
- 🔲 Selection UI: checkbox-lista med ghost-typ (PB, WR, Friend-1, Friend-2)

**Elimination:**
- 🔲 Server trackar checkpoint-ordning per spelare i `Room.checkpointOrder: int[][]`
  - Vid checkpoint N: när alla passerat → sista spelaren elimineras
  - Broadcast: `{ type: "player_eliminated", playerId, checkpoint }`
  - Eliminerad: `PlayerSocket.isEliminated = true`, skickar fortfarande spectator-data
- 🔲 Frontend: eliminerings-flash (röd fullscreen, "ELIMINATED") + auto-spectator
- 🔲 Sista kvarvarande spelare vinner (broadcast `race_finished`)

**Tag:**
- 🔲 "It"-spelare: server väljer random vid `race_start`, broadcast `{ type: "tag_it", playerId }`
- 🔲 Tag-transfer: server kollar proximity (alla spelares positioner finns i PositionBuffer)
  - Om distance(it, other) < 3.0 units: transfer tag, broadcast `tag_transfer`
  - Server-auktoritativt (ingen client-side detection — server har alla positioner)
- 🔲 "It" penalty: server markerar i PositionBuffer, klient visar rödglöd + speed overlay
- 🔲 Timer: server trackar `timeAsIt` per spelare → vid game-end: lägst tid vinner
- 🔲 Duration: 3 minuter, countdown visas i HUD

**Relay:**
- 🔲 Lag-tilldelning: host drag-and-drop i lobby (2 lag, 2-4 spelare per lag)
  - `{ type: "set_team", playerId, team: 0|1 }` (host-only)
- 🔲 Sections: checkpoints delar banan i lika sektioner (cp 0→1 = section 1, cp 1→2 = section 2, etc.)
- 🔲 Baton pass: vid checkpoint N → nuvarande löpare freezas, nästa löpare i laget spawnar
  - Server broadcast: `{ type: "baton_pass", team, fromPlayer, toPlayer, checkpoint }`
  - Icke-aktiva spelare ser spectator-vy av sin lagkompis
- 🔲 Resultat: lagvis total-tid (sum av sektioner)

---

### T5 — Spectator Mode
*Zero-cost spectators — tar emot broadcast utan att skicka positionsdata.*

- 🔲 **Spectator-join** — WebSocket till `/ws/race/{roomId}?spectate=true`
  - Server: `Room.AddSpectator(ws)` — läggs till broadcast-mottagare men ej i PositionBuffer
  - Spectators räknas inte mot maxPlayers
  - Spectators får alla broadcasts (positions, lifecycle, chat) men servern ignorerar inbound (utom disconnect)
  - Spectator-count exponeras i room-metadata (lobby visar "3 watching")

- 🔲 **Spectator-kamera** — `engine/camera/SpectatorCamera.tsx`
  - Props: `{ mode: 'free' | 'follow', targetPosition?: Vec3, targetYaw?: number }`
  - Free mode: WASD + mus-look (samma som editor-kamera, utan pointer lock)
  - Follow mode: smooth lerp mot target ghost position, offset bakom (3rd person)
  - Tab-key: cykla genom spelare (nästa i slot-ordning)
  - Klick på ghost: lock follow-mode till den spelaren

- 🔲 **Spectator HUD** — `engine/hud/SpectatorOverlay.tsx`
  - Props: `{ players: SpectatorPlayerInfo[], selectedPlayer?: string }`
  - Sidebar: alla spelare med placering, tid, checkpoint, speed
  - Vald spelare: larger name + speed-meter i center
  - Minimap med alla spelare (samma komponent som race HUD)

---

### T6 — Server-Side Anti-Cheat & Validering
*Heuristisk validering — servern har alla positioner i PositionBuffer och kan korsvalidera.*

- 🔲 **`AntiCheatValidator`** — per-room instans, körs i Room.ProcessInbound
  - Tar emot varje position-update INNAN den skrivs till PositionBuffer
  - Returnerar `Allowed | Flagged | Rejected`

- 🔲 **Speed-validering:**
  - Beräkna `actual_speed = distance(prev_pos, curr_pos) / dt`
  - Jämför med rapporterad `speed` ± 10% tolerans
  - Om `actual_speed > 2000 u/s` konsekvent (5+ updates): flag
  - Om `actual_speed > 5000 u/s`: reject (skriv ej till buffer)
  - Logg: `devLog.warn('AntiCheat', 'Player {name} speed anomaly: {speed}')`

- 🔲 **Teleport-detection:**
  - `distance(prev, curr) > maxSpeed * dt * 2.0` → möjlig teleport
  - Tillåt 3 teleports per race (respawn, grapple launch, rocket jump)
  - 4:e → flag, 7:e → kick med `{ type: "kicked", reason: "teleport anomaly" }`

- 🔲 **Finish-time validering:**
  - `finishTime < map.MinExpectedTime` → reject
  - `MinExpectedTime` beräknas: `totalCheckpointDistance / 1500` (max rimlig speed)
  - Server lagrar `checkpoint_timestamps[]` per spelare — kan verifiera att split-times är realistiska

- 🔲 **Rate limiting (inbyggt i Room):**
  - Position-messages: max 25/s per spelare (Channel bounded backpressure)
  - Chat: max 2/s (token bucket i Room)
  - Lifecycle commands: max 5/s

- 🔲 **Replay-submission (stretch):**
  - Vid finish: klient skickar komprimerad replay-data via WebSocket binary
  - Server sparar till DB (ReplayData blob)
  - Offline-validering: bakgrundsjobb kan verifiera replay mot checkpoints
  - Full physics replay-validering (headless Rapier) markerad som framtida mål

---

### T7 — Skalning & Horisontell Distribution
*Från en server till cluster — Redis backplane + room-routing.*

- 🔲 **Redis Pub/Sub backplane** — för multi-server deployment
  - NuGet: `StackExchange.Redis`
  - `RedisBackplane` service: subscribe/publish per room-kanal
  - Scenario: om spelare A connectar till server 1 och spelare B till server 2 i samma rum
    → server 1 publishar positioner till Redis → server 2 subscribar → broadcastar till B
  - Fallback: utan Redis körs allt in-process (single-server, nuvarande modell)

- 🔲 **Room-routing** — reverse proxy (nginx/YARP) routar WebSocket per roomId
  - Konsistent hashing: `roomId → serverId` — alla spelare i samma rum hamnar på samma server
  - Eliminerar Redis-overhead för position-data (95% av trafiken)
  - Redis behövs bara för room-discovery (vilken server äger vilka rum) och cross-server events

- 🔲 **Connection-pool limits:**
  - Kestrel: `MaxConcurrentConnections: 50_000` (default unlimited, men explicit config)
  - Per-room: `MaxPlayers: 32` (hard cap i Room)
  - Per-server: `MaxRooms: 5000` (soft cap, monitoring)
  - Memory budget: ~2KB per player socket + 32KB per room overhead → 80K spelare ≈ 2.5 GB

- 🔲 **Monitoring & metrics:**
  - Exponera: aktiva rum, spelare online, messages/s, genomsnittlig latency
  - Endpoint: GET `/api/admin/metrics` (auth required)
  - Integration: Prometheus-format (`IMetrics` interface)

- 🔲 **Load testing:**
  - `Velocity.LoadTest` projekt: simulera 1000+ WebSocket-klienter med fake position-streams
  - Mät: latency P50/P95/P99, throughput, memory, CPU
  - Identifiera breakpoint: vid vilken load degraderar latency >100ms?

---

### T8 — Multiplayer Polish & UX
*Finputsning — allt som gör multiplayer-upplevelsen smooth.*

- 🔲 **Latency-indikator (HUD)**
  - `transport.latencyMs` → exponeras via `raceStore.latency`
  - Engine: `engine/hud/LatencyIndicator.tsx` — props: `{ latencyMs, quality }`
  - Färg: grön <50ms, gul 50-100ms, orange 100-200ms, röd >200ms
  - Visa: "23 ms" + färgad prick i övre hörnet

- 🔲 **Reconnect-flow:**
  - Transport auto-reconnect (exponential backoff, max 10 försök)
  - Vid reconnect: skicka `{ type: "rejoin", roomId, lastTimestamp }` → server svarar med snapshot
  - Snapshot: alla spelares senaste position + room state + chat-historik (senaste 20)
  - Smooth reentry: interpolera till korrekt state (ingen teleport-känsla)
  - Om room försvunnit (cleanup): visa "Race ended" dialog

- 🔲 **Ljud-feedback (synth via AudioManager):**
  - Player joined: stigande arpeggio (C-E-G, 50ms per ton)
  - Player left: fallande ton (G→C, 100ms)
  - Countdown: 3=C4 (200ms), 2=E4 (200ms), 1=G4 (200ms), GO=C5 (400ms, +octave)
  - Player finished: kort fanfar (triumf-chord, C-E-G-C, 80ms staccato)
  - Eliminated: mörk stinger (Cm diminished, 300ms)
  - Chat received: kort "tick" (white noise burst, 20ms)

- 🔲 **Race-progress bar** — `engine/hud/RaceProgressBar.tsx`
  - Props: `{ players: Array<{ id, name, color, progress, isLocal }>, totalCheckpoints }`
  - Horisontell bar: varje spelare = färgad prick som glider längs banan
  - Progress: `(checkpointIndex + fractionToNext) / totalCheckpoints`
  - Lokal spelare markerad med outline, namn alltid synligt

- 🔲 **Player-lista under race** — `engine/hud/RaceLeaderboard.tsx`
  - Props: `{ players: RacePlayerInfo[] }`
  - Kompakt sidebar (höger): #1 PlayerA 01:23.45 CP 4/7, #2 PlayerB...
  - Sorterad: checkpoint-progress → tid → speed
  - Uppdateras ~4Hz (inte varje frame)
  - Lokal spelare highlighted, finished spelare markerade med checkmark

- 🔲 **"Play Again" rematch-flow:**
  - Host klickar "Play Again" → `{ type: "rematch_request" }` via WebSocket
  - Alla spelare ser popup: "Host wants rematch — Join? [Yes] [No]" (15s timeout)
  - Accept: `{ type: "rematch_accept" }` → server auto-joins nytt rum
  - Host som gets enough accepts: server skapar nytt rum, broadcast `{ type: "rematch_room", roomId }`
  - Transport auto-reconnects till nytt rum

- 🔲 **Quick-play matchmaking:**
  - "Quick Play" knapp i main menu → POST `/api/matchmaking/queue` med `{ gameMode, mapId? }`
  - Backend: `MatchmakingService` matchar spelare i kö (FIFO, 4-8 per rum)
  - SSE: `/api/sse/matchmaking` → `{ type: "match_found", roomId }` → klient auto-joins
  - Timeout: 60s → "No match found, try again?"

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

## Fas C — Camera Perspective (FPS / TPS)
*Stöd för förstaperson (default) och tredjeperson. Spelaren väljer perspektiv i settings eller togglar med keybind.*

| Läge | Kamera | Visar |
|------|--------|-------|
| FPS (default) | I ögonhöjd | Händer + vapen (ViewmodelLayer) |
| TPS | Bakom ryggen | Hela karaktären |

**Förutsättning:** Fas L (Viewmodel) ✅, Fas P (Movement) ✅

### C1 — Camera Rig & Perspective Switch
*Grundläggande kamerarig som stödjer båda perspektiven, med smooth transition.*

**Engine (`src/engine/`):**
- 🔲 **`engine/camera/CameraRig.tsx`** — perspektiv-agnostisk kamerarig
  - Props: `{ mode: 'fps' | 'tps', target: Vector3, yaw, pitch, fpsEyeOffset, tpsDistance, tpsHeight, tpsSideOffset }`
  - FPS: kameran i ögonhöjd (`fpsEyeOffset`), direkt kopplad till capsule-position
  - TPS: kameran bakom ryggen (`tpsDistance: 3.5`, `tpsHeight: 1.5`, `tpsSideOffset: 0.5`)
  - Smooth lerp vid perspektivbyte (0.3s transition)
- 🔲 **TPS kamera-kollision** — raycast bakåt från target, pull camera forward vid vägg
  - `rapierWorld.castRay()` från spelarposition → kameraposition
  - Clamp kameraavstånd till ray-hit distance - 0.2 (offset)
  - Smooth recovery när hindrande vägg försvinner (lerp tillbaka till `tpsDistance`)
- 🔲 **`settingsStore` utökning** — `cameraPerspective: 'fps' | 'tps'` (default: `'fps'`)
  - TPS-specifika settings: `tpsDistance`, `tpsHeight`, `tpsSideOffset`
  - Keybind: `togglePerspective` (default: `V`) — toggle FPS↔TPS in-game

### C2 — Third-Person Player Model
*I TPS visas hela karaktärsmodellen istället för bara händer + vapen.*

**Engine (`src/engine/`):**
- 🔲 **`engine/rendering/PlayerModel.tsx`** — tredjepersons karaktärsmodell
  - Props: `{ position, yaw, pitch, stance, isMoving, speed, animationState }`
  - Renderar fullständig karaktärsmesh (capsule placeholder → utbytbar modell)
  - Animationsblending: idle, run, crouch, prone, slide, jump, fall
  - Vapen visas i karaktärens händer (world-space, ej viewmodel-lager)
- 🔲 **Viewmodel-lager toggle** — FPS: visa ViewmodelLayer (händer + vapen), TPS: göm ViewmodelLayer + visa PlayerModel
  - `ViewmodelLayer` visibility kopplad till `cameraPerspective === 'fps'`
  - PlayerModel visibility kopplad till `cameraPerspective === 'tps'`

**Game (`src/game/`):**
- 🔲 **`game/components/game/PlayerVisuals.tsx`** — wrapper som läser stores
  - Läser `settingsStore.cameraPerspective` + `gameStore`/`combatStore` state
  - Passar props till engine `CameraRig` + `PlayerModel`

### C3 — TPS Crosshair & Aiming
*Tredjepersons sikte — over-the-shoulder aim med crosshair i skärmcenter.*

- 🔲 **Over-the-shoulder aim** — TPS crosshair raycaster från skärmcenter (ej vapenposition)
  - Raycast från kamera genom skärmens mittpunkt → world hit point
  - Karaktären roterar överkroppen mot hit point (upper body IK, stretch goal)
  - ADS i TPS: kameran zoomar in + närmar sig axel ("aim mode"), `tpsDistance: 1.5`
- 🔲 **Crosshair anpassning** — crosshair synlig i båda lägen, men TPS-crosshair har dot-style default
- 🔲 **Projectile origin** — FPS: skjuter från kameraposition, TPS: skjuter från vapenposition men riktar mot crosshair hit point
  - Beräkna riktningsvektor: `normalize(crosshairHitPoint - weaponWorldPosition)`

### C4 — TPS Movement & Camera Feel
*Anpassa movement-feedback och kamera-feel för tredjeperson.*

- 🔲 **Kamera-lag** — TPS-kameran följer med liten fördröjning (smooth damp, `tpsCameraLag: 0.1`)
  - Position-lag: kameran "hänger efter" vid snabba rörelser
  - Rotation-lag: kameran roterar mjukare (lerp yaw/pitch)
- 🔲 **Sprint-kamera** — vid sprint: FOV +5°, kameran drar tillbaka något
- 🔲 **Slide/prone-kamera** — TPS-kameran sänks vid crouch/prone, pull-back vid slide
- 🔲 **Wall-run kamera-tilt** — vid wall-run: kameran tiltar mot väggen (anpassat för TPS-vy)
- 🔲 **Grapple-kamera** — under grapple: kameran pulls back för att visa svängen bättre

---

## Beroendeöversikt

```
Fas C (Camera Perspective)           ← NY
├── C1 Camera Rig & Switch           beroende: L (Viewmodel) ✅, P (Movement) ✅
├── C2 Third-Person Player Model     beroende: C1
├── C3 TPS Crosshair & Aiming       beroende: C1
├── C4 TPS Movement & Camera Feel   beroende: C1

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

Fas T (Multiplayer)                    ← BLEEDING EDGE REWRITE
├── T0 WebSocket Transport Layer       beroende: Fas 12 (SSE infra) ✅ — ersätter SSE
│   ├─ Backend: WS endpoint, RoomManager, Room (Channel<T>), BroadcastLoop
│   ├─ Frontend: IGameTransport abstraction, binary PositionCodec
│   └─ Binärt protocol: 25 bytes/spelare (vs ~180 bytes JSON = 7×)
├── T1 Race Lifecycle & Countdown      beroende: T0
├── T2 Ghost Rendering (Instanced)     beroende: T0
│   └─ 1 draw call alla ghosts, GPU-text (ej DOM), instanced trails
├── T3 Chat & Social                   beroende: T0
├── T4 Game Modes                      beroende: T1, T2
│   ├─ Race, TimeAttack, GhostRace, Elimination, Tag, Relay
│   └─ IGameModeHandler — server-side mode-dispatch
├── T5 Spectator Mode                  beroende: T2, T1
├── T6 Anti-Cheat                      beroende: T0 (server har alla positioner)
├── T7 Skalning & Distribution         beroende: T0
│   └─ Redis backplane, room-routing, load testing
├── T8 Multiplayer Polish              beroende: T1-T5

Parallellism:
  C1 kan starta direkt (alla förutsättningar ✅)
  C2+C3+C4 parallellt efter C1
  C kan köras parallellt med V, R, T och Q (inga beroenden emellan)
  V1+V3+V6+V7+V8+V9 kan alla starta parallellt
  V2 väntar på V1 (ADS krävs för scope)
  V4 och V10 kan starta parallellt med V1
  V5 bör komma efter V1 (ADS-recoil-multiplikator)
  Q kan köras helt parallellt med V, R och T (inga beroenden)
  R, T och V kan köras parallellt (inga beroenden emellan)
  T0 först (fundament — ersätter SSE för race)
  T1 + T2 parallellt efter T0 (lifecycle + rendering oberoende)
  T3 kan starta parallellt med T1/T2 (chat via WS direkt)
  T4 kräver T1 + T2 (game modes bygger på race-flow + ghost-rendering)
  T5 efter T2 (spectator behöver ghost-rendering)
  T6 efter T0 (anti-cheat validerar i Room.ProcessInbound)
  T7 kan starta efter T0 men bör vänta tills T1-T4 stabiliserat sig
  T8 sist (polish — kräver allt annat fungerande)
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
