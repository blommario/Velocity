# VELOCITY — Gameplay & Graphics Plan

> Fokus: spelupplevelse, grafik, physics, assets.
> Multiplayer, community, socialt **parkerat** tills kärnan är polerad.
> ✅ = klart | 🔲 = kvar | 🔧 = pågår

---

## Fas A — Asset Pipeline & glTF Loading
*Innan vi kan höja grafiken behöver spelet kunna ladda riktiga 3D-modeller och texturer.*

**Förutsättning:** Ingen

### A1 — glTF Model Loader
- ✅ GLTFLoader integration — `assetManager.ts` med GLTFLoader + DRACOLoader (WebGPU-kompatibel)
- ✅ Asset manager — cache för laddade modeller, progress-callbacks, lazy loading
- ✅ Model placement i MapData — `MapModel` interface med `modelUrl`, position, rotation, scale
- ✅ Collider-generering från mesh — `ModelBlock` component med trimesh/hull via `MeshCollider`

### A2 — PBR Texture System
- ✅ Texture loader — `loadTexture()` med sRGB/linear color space, RepeatWrapping
- ✅ Texture atlas / manager — `loadTextureSet()` med cache, undviker duplicerade laddningar
- ✅ Material factory — `useTexturedMaterial` hook skapar MeshStandardMaterial från texture-set
- ✅ Per-block texture override — MapBlock `textureSet` + `textureScale` fält

### A3 — HDRI Skybox
- ✅ RGBELoader — `loadHDRI()` i assetManager, laddar .hdr med EquirectangularReflectionMapping
- ✅ Fallback — `HdriSkybox` component, ProceduralSkybox kvarstår som standard
- ✅ Environment map reflection — `scene.environment` sätts via PMREMGenerator
- ✅ Per-map skybox config — `SkyboxType = ProceduralSkyboxType | 'hdri:filename'`

### A4 — Asset Downloads (CC0)
- ✅ **Quaternius Modular Sci-Fi MEGAKIT** — 190 glTF modeller (Walls, Platforms, Columns, Props, Decals, Aliens) (CC0)
  - Extraherat till `frontend/public/assets/models/quaternius-scifi/glTF/`
- ✅ **Kenney Space Kit** — 153 FBX modeller (korridorer, hangarer, maskiner, rymdskepp) (CC0)
  - Extraherat till `frontend/public/assets/models/kenney-space-kit/`
  - FBXLoader tillagt i assetManager.ts
- ✅ **Poly Haven Night HDRI** — `satara_night_2k.hdr` + `dikhololo_night_2k.hdr` (CC0, 2K)
- ✅ **3dtextures.me Sci-Fi Panels** — 6 PBR texture-set (wall-013, wall-015, metal-panel-005/007, metal-mesh-002, metal-grill-024)
  - Extraherat till `frontend/public/assets/textures/scifi-*/`
- ✅ **ambientCG Metal/Concrete** — `metal-009` + `concrete-034` PBR texturer (CC0, 1K)
- ✅ Organisera assets i `frontend/public/assets/` — models/, textures/, hdri/

---

## Fas B — Grafik & Visuell Kvalitet
*Höj renderingskvaliteten markant med riktiga assets och moderna effekter.*

**Förutsättning:** Fas A (asset pipeline)

### B1 — Material Upgrade
- 🔲 Normal mapping — alla större ytor (golv, väggar, plattformar) med normal maps
- 🔲 Roughness/Metalness variation — metalliska ytor reflekterar ljus, betong/sten är matta
- 🔲 Emissive detail maps — neon-accenter, skärmar, varningsljus med emissive textures
- 🔲 Instanced rendering med texturer — InstancedBlocks stöder texture-sets per grupp

### B2 — Lighting Upgrade
- 🔲 Screen-space reflections (SSR) — TSL postprocessing pass för speglande ytor
- 🔲 Area lights — emissive paneler som ljuskällor (approximerad via rect lights)
- 🔲 Light probes — baked irradiance för inomhusmiljöer (korridorer, rum)
- 🔲 Volumetric light shafts — god rays genom fönster/öppningar (TSL compute)

### B3 — Miljöeffekter
- 🔲 Animerade vatten/lava-ytor — TSL shader med wave displacement, reflektion, glow
- 🔲 Rök/dimma-partiklar — GPU compute, placeras i specifika zoner (ventilation, lava)
- 🔲 Damm/gnistor — ambient partiklar i industriella miljöer
- 🔲 Decals — spår efter explosioner, skotthål, markeringar på ytor

### B4 — Kamera & Post-Processing
- 🔲 SSAO förbättring — tuna GTAO-parametrar med nya material (normal maps ger bättre AO)
- 🔲 Motion blur — per-object velocity-baserad blur vid hög hastighet (valfritt i settings)
- 🔲 Chromatic aberration — subtil vid extrema hastigheter (>600 u/s)
- 🔲 Color grading LUT — per-map color grade (Neon: kall cyan, Cliffside: varm orange)
- 🔲 Depth of field — enbart i menyer/end-of-run (aldrig under gameplay)

---

## Fas C — Physics & Movement Feel
*Finjustera känslan. Varje mekanik ska vara satisfying att använda.*

**Förutsättning:** Ingen (kan köras parallellt med A/B)

### C1 — Kärnrörelse
- 🔲 Bunny hop consistency — verifiera att bhop ger konsekvent speedgain per hop
- 🔲 Air strafe precision — testa och justera AIR_ACCEL/speed cap för tighta turns
- 🔲 Landing recovery — frames mellan landing och nästa hopp ska vara 0 (instant bhop)
- 🔲 Speed preservation vid ramphopp — horisontell hastighet ska inte sjunka vid ramp-launch
- 🔲 Slope boosting — nedförsbackar ger acceleration (gravity component projicerad längs slope)

### C2 — Avancerad Rörelse
- 🔲 Wall run polish — smooth entry/exit, snabbare väggdetektering, bättre kameratilt
- 🔲 Surf ramp feel — testa Cliffside/Skybreak surf-sektioner, justera friktions-ramper
- 🔲 Crouch slide chain — slide → jump → slide ska vara fluid utan input-drops
- 🔲 Grapple swing momentum — verifiera pendel-fysik, release-boost ska vara pålitlig
- 🔲 Edge grab / mantle — håll jump vid kanter för att klättra upp (ny mekanik, valfritt)

### C3 — Vapenrörelse
- 🔲 Rocket jump consistency — verifiera att self-knockback alltid fungerar oavsett vinkel
- 🔲 Shotgun jump — verifiera 350 u/s self-knockback, testa double shotgun jump
- 🔲 Knife lunge precision — dash-riktning ska följa kameran exakt
- 🔲 Plasma surfing — continuous pushback ska kunna användas för sustained flight
- 🔲 Grenade boost — verifiera timing-baserad boost (2.5s fuse)

### C4 — Game Feel & Feedback
- ✅ Rocket projectile upgrade — större kärna (0.35r), yttre glow-halo (0.6r), dynamisk pointlight, eldsvans (5 trail-sfärer)
- ✅ Explosion upgrade — 192 partiklar (3x), större sprites (0.5), snabbare burst (14 u/s), längre liv (1.0s), starkare glow (4x)
- ✅ Grenade projectile upgrade — större sfär (0.18r), pointlight
- 🔲 Weapon viewmodel — enkel 3D-modell per vapen i nedre högra hörnet (first person)
- 🔲 Muzzle flash — ljusblixt + partiklar vid avfyrning
- 🔲 Impact particles — gnistor/debris vid kulträff på ytor
- 🔲 Wall run sparks — gnistpartiklar vid väggkontakt
- 🔲 Speed gate whoosh — visuell distortion-ring vid passage
- 🔲 Screen shake tuning — intensitet per vapentyp, avtagande med avstånd
- 🔲 Hit marker — visuell + audio feedback vid träff

---

## Fas D — Ljud & Audio
*Ersätt synth-ljud med riktiga ljud. Lägg till musik och ambience.*

**Förutsättning:** Fas C (behöver veta vilka actions som finns)

### D1 — Sound Effects (CC0)
- 🔲 Ladda ner SFX-pack — OpenGameArt "50 CC0 Sci-Fi SFX" + Freesound CC0
- 🔲 Migrera AudioManager från synth till samples — Web Audio API `AudioBufferSourceNode`
- 🔲 Rörelse-ljud — footsteps (metall/betong/glas), jump, land, slide, wall run
- 🔲 Vapen-ljud — rocket fire/explode, grenade throw/bounce/explode, sniper crack, shotgun pump, AR burst, plasma hum, knife swish
- 🔲 Miljö-ljud — boost pad whoosh, speed gate hum, grapple wire, checkpoint chime, finish fanfare
- 🔲 UI-ljud — button click, menu transition, countdown beeps

### D2 — Spatial Audio
- 🔲 3D-positionerat ljud — explosioner, projektiler, boost pads med distance falloff
- 🔲 Reverb per miljö — stor/liten hall, utomhus, korridor (ConvolverNode)
- 🔲 Doppler-effekt — projektiler som passerar (valfritt)

### D3 — Musik & Ambience
- 🔲 Ambient loops per map-tema — industriell hum, rymd-drone, neon-beat
- 🔲 Dynamisk musik — intensitet ökar med spelarens hastighet
- 🔲 Menu music — lugn loop för main menu
- 🔲 Victory/defeat stingers — kort musikeffekt vid run complete / death

---

## Fas E — Banor & Level Design
*Nya banor som utnyttjar alla mekaniker och nya assets.*

**Förutsättning:** Fas A+B (assets & grafik) + Fas C (polerad physics)

### E1 — Uppgradera befintliga banor
- 🔲 First Steps — byt ut primitiva boxar mot Quaternius/Kenney-modeller, tutorial-text
- 🔲 Cliffside — klipp-texturer, HDRI skybox, bättre belysning, atmosfär
- 🔲 Neon District — neon-paneler med emissive textures, reflektioner i golv, regn-partiklar
- 🔲 The Gauntlet — industriella modeller, rök, varningsljus, lava-kill zones
- 🔲 Skybreak — rymdstation-modeller, glasgolv med stars under, rymd-HDRI

### E2 — Nya banor
- 🔲 **"Orbital"** (Expert) — Rymdstation inomhus, korridorer (Quaternius modular kit), låg gravitation-zoner, glasväggar med rymd utanför, grapple chains
- 🔲 **"Molten Core"** (Hard) — Lavagruva, animerade lava-ytor, rörliga plattformar, stigande lava-timer, industriella texturer
- 🔲 **"Speedway"** (Medium) — Ren hastighet, boost pad chains, surf ramps i sekvens, WR-fokus, clean design
- 🔲 **"Vertigo"** (Hard) — Extremt vertikalt torn, spiral-ramper, grapple-chains, inget golv
- 🔲 **"Frostbite"** (Medium) — Is-texturer, låg friktion-ytor, grottgångar, frostdimma

### E3 — Map Editor v2
- 🔲 Prefabs — sparade block-grupper som kan återanvändas
- 🔲 3D-modell placering — drag-and-drop glTF-modeller i editor
- 🔲 Texture picker — välj texture-set per block
- 🔲 Decorations — icke-kolliderande visuella objekt
- 🔲 Map thumbnails — auto-screenshot vid publicering

---

## Fas F — Gameplay Loop Polish
*Allt som gör spelet beroendeframkallande att spela om och om igen.*

**Förutsättning:** Fas C + E (polerad physics + banor)

### F1 — Tutorial & Onboarding
- 🔲 Interaktiv tutorial — guidade steg med tip-popups och visuella markeringar
- 🔲 Rörelse-tutorial — bhop, strafe jump, air strafe med instant feedback
- 🔲 Avancerad tutorial — rocket jump, wall run, surf, grapple
- 🔲 Practice mode — checkpoint-restart, segment-timer, ghost-trail av bästa run

### F2 — Replay & Ghost System
- 🔲 Replay viewing UI — play/pause/scrub, frikamera, speed control
- 🔲 Ghost rendering — transparent spelarkapsel som kör bästa run
- 🔲 PB comparison — live split-tider mot personal best under run
- 🔲 Replay export — spara replay som delbar fil

### F3 — End-of-Run Experience
- 🔲 Detaljerad stats-skärm — max speed, total distance, jumps, rocket jumps, air time
- 🔲 Checkpoint split breakdown — tid per segment, delta mot PB
- 🔲 Medal system — guld/silver/brons baserat på par time
- 🔲 "One more run" flow — snabb retry utan att lämna spelskärmen

---

## Beroendeöversikt

```
┌── Fas A (Asset Pipeline) ──────────────┐
│   └── Fas B (Grafik Upgrade)           │
│       └── Fas E (Banor & Level Design) │
│                                        │
├── Fas C (Physics & Feel) ──────────────┤
│   ├── Fas D (Ljud & Audio)             │
│   └── Fas E (Banor & Level Design)     │
│       └── Fas F (Gameplay Loop Polish)  │
└────────────────────────────────────────┘
```

**Parallella spår:**
- **Spår 1:** A → B → E (grafik pipeline)
- **Spår 2:** C → D (physics + ljud)
- **Korsning:** E kräver både B och C
- **Slutfas:** F (gameplay loop) kräver E + C

**Rekommenderad prioritet:**
1. **Fas A** — Asset pipeline (lås upp allt annat)
2. **Fas C** — Physics feel (kan köras parallellt med A)
3. **Fas B** — Grafik upgrade (kräver A)
4. **Fas D** — Ljud (kräver C)
5. **Fas E** — Banor (kräver A+B+C)
6. **Fas F** — Gameplay loop polish

---

## Parkerat (framtida faser)

Dessa faser är **inte borttagna**, bara parkerade tills kärnan är klar:

- **Multiplayer** — Live race, ghost race, SSE broadcasting
- **Matchmaking** — ELO, ranked, seasons
- **Socialt** — Friends, activity feed, achievements
- **Game Modes** — Elimination, tag, relay, time attack
- **Community** — Map rating, tags, featured maps, comments
