# VELOCITY — Gameplay & Content Plan

> Engine-arbete (Fas A, G–N) + grafik (O) + movement (P) + engine-refaktorisering (E) klart.
> Kvar: gameplay mechanics (V), banor (R), multiplayer (T).
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
*SSE backend + race rooms + race store finns. Kvar: game modes.*

**Förutsättning:** Ingen

### T4 — Game Modes
- 🔲 Time Attack — solo timed run (befintligt, men med dedicated mode + constraints)
- 🔲 Ghost Race — race mot sparade ghosts (PB, WR, friends)
- 🔲 Elimination — sista spelaren per checkpoint elimineras
- 🔲 Tag — en spelare "it", fånga andra via proximity
- 🔲 Relay — lag-baserat, spelare turas om per sektion

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

### V3 — Weapon Inspect
*Håll inspect-knapp → vapnet lyfts framför kameran och roteras långsamt.*
- 🔲 Keybind: `inspect` (default `F`) i settingsStore
- 🔲 Inspect-state i combatStore: `isInspecting: boolean`
- 🔲 Viewmodel inspect-animation: position → center-screen, rotation → slow Y-axis spin
- 🔲 Inspect kräver: inte ADS, inte firing, inte reloading
- 🔲 Avbryt inspect automatiskt vid: fire, ADS, weapon switch, damage taken, movement input
- 🔲 Kamera-DOF under inspect (bakgrund blurras subtilt)
- 🔲 Inspect-ljus — liten punktljuskälla framför modellen (emissive boost)

### V4 — Stances (Crouch / Prone / Slide)
*Utöka befintligt crouch-system med prone och förbättrad slide.*
- 🔲 **Prone (liggande)**
  - Keybind: dubbeltryck `crouch` ELLER dedikerad `prone`-knapp (default `Z`)
  - Capsule-höjd: 0.5 (från 1.8/1.0), eye offset: 0.1
  - Max speed: 30 u/s (crawl), no jump, slow stand-up (0.4s)
  - Accuracy boost: `PRONE_SPREAD_MULT: 0.3` (assault/sniper)
  - Entry: crouch → prone (0.3s transition), prone → crouch → stand
  - Blockera prone om utrymme saknas (capsule overlap-check)
- 🔲 **Slide förbättring**
  - Slide boost: +40 u/s burst vid slide-start (redan definierad men oanvänd)
  - Slide-hop: jump under slide behåller momentum + liten boost
  - Slide duration cap: 1.5s → friction ramp-up
  - Head-tilt framåt under slide (camera pitch -5°)
  - Slide-ljud (synth whoosh)
- 🔲 **Crouch-jump**
  - Crouch hålls under jump → lägre capsule i luften
  - Tillåter passage genom lägre öppningar
  - Automatisk stand-up vid landing om utrymme finns
- 🔲 **Stance-indikator i HUD** — ikon: standing / crouching / prone / sliding

### V5 — Weapon Recoil & Spread
*Kamera-recoil + visuell spread-feedback, inte bara viewmodel-bob.*
- 🔲 Recoil-pattern per vapen: vertikal + horisontell offset per skott
  - Assault: litet vertikalt recoil, ackumulerar vid auto-fire, reset 0.3s
  - Sniper: stort engångs-recoil (5° pitch up), snabb recovery
  - Shotgun: brett recoil (2° random), snabb recovery
  - Rocket: minimal (exploision-knockback är feedbacken)
- 🔲 Recoil-recovery: kameran återgår automatiskt (lerp mot origin, `RECOIL_RECOVERY_SPEED`)
- 🔲 Crosshair bloom: dynamic spread-indikator, expanderar vid fire → krymper vid stasis
- 🔲 ADS reducerar recoil: `ADS_RECOIL_MULT: 0.5`
- 🔲 Prone reducerar recoil ytterligare: `PRONE_RECOIL_MULT: 0.3`
- 🔲 Movement ökar spread: `MOVING_SPREAD_MULT: 1.5` (ground), `AIR_SPREAD_MULT: 2.0`

### V6 — Reload System
*Faktisk reload-mekanik med animation och timing.*
- 🔲 Reload-state i combatStore: `isReloading: boolean`, `reloadTimer: number`
- 🔲 Reload-tid per vapen:
  - Assault: 2.0s (mag-baserad)
  - Sniper: 2.5s
  - Shotgun: 0.5s per shell (interruptible)
  - Plasma: 3.0s (full recharge)
  - Rocket: 1.5s
  - Grenade: 1.0s
  - Knife: ingen reload
- 🔲 Viewmodel reload-animation: weapon dips down → comes back up
- 🔲 Auto-reload vid tom mag (med 0.5s fördröjning)
- 🔲 Reload avbryts av: weapon switch, fire (om shells kvar, shotgun), sprint
- 🔲 Reload-progress bar i CombatHud (cirkulär runt crosshair)
- 🔲 Ammo pickup → direkt till reserve, inte mag

### V7 — Headshots & Hitboxes
*Zonbaserad skada med headshot-multiplikator.*
- 🔲 Hitbox-zoner: head (×2.5), torso (×1.0), limbs (×0.75)
- 🔲 Headshot-indikator: speciell hitmarker (röd ×) + ljud
- 🔲 Headshot-streak counter (HUD, fades efter 3s)
- 🔲 Raycast hitbox-check via extra collider-shapes på target (head sphere, torso box)
- 🔲 Kritisk-skada indikator (>50% hp i ett slag → screen flash röd)

### V8 — Weapon Wheel & Quick-Switch
*Snabbare vapenval utöver 1-7 tangenter.*
- 🔲 Weapon wheel: håll `Q` → radialmeny med alla vapen + ammo-status
- 🔲 Quick-switch: `Q` tap → senaste vapnet (last weapon toggle)
- 🔲 Scroll wheel cyklar vapen (befintligt, men lägg till wrap-around + HUD-indikator)
- 🔲 Weapon wheel visar: ikon, namn, ammo, keybind
- 🔲 Slow-mo under wheel (0.3× timescale, bara i singleplayer)

### V9 — Killstreak & Combat Feedback
*Förstärkt stridsfeedback och momentum-känsla.*
- 🔲 Killstreak counter: consecutive kills utan att dö → HUD-display
- 🔲 Multikill-popup: "Double Kill", "Triple Kill" etc. med timing-fönster (3s)
- 🔲 Combo-system: snabba kills/checkpoints → speed bonus multiplier
- 🔲 Hit sound pitch scaling: konsekutiva träffar → stigande pitch
- 🔲 Screen-shake vid explosioner (redan i settings, koppla till recoil)
- 🔲 Slow-mo vid sista kill/checkpoint (0.2s bullet-time)

### V10 — Advanced Movement Polish
*Sista finputsningen av movement-systemet.*
- 🔲 **Bunny hop timing window**: perfekt timing vid landing → speed boost (+10 u/s)
- 🔲 **Speed cap visualization**: HUD-indikator vid >500 u/s, >800 u/s, >1000 u/s tier-colors
- 🔲 **Dash/dodge**: dubbeltryck strafe → kort burst (100 u/s) med 2s cooldown
- 🔲 **Wall-jump combo**: wall-run → jump → opposite wall-run → jump (chain bonus)
- 🔲 **Grapple-swing momentum preservation**: release timing påverkar boost (early = up, late = forward)
- 🔲 **Movement-trail particles**: synliga för ghosts/multiplayer (visar rutt)

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
├── V8 Weapon Wheel & Quick-Switch   beroende: inga
├── V9 Killstreak & Combat Feedback  beroende: inga
├── V10 Advanced Movement Polish     beroende: V4 (stances), P (movement)

Fas R (Banor)
├── R3 Editor v2

Fas T (Multiplayer)
├── T4 Game Modes

Parallellism:
  V1+V3+V6+V7+V8+V9 kan alla starta parallellt
  V2 väntar på V1 (ADS krävs för scope)
  V4 och V10 kan starta parallellt med V1
  V5 bör komma efter V1 (ADS-recoil-multiplikator)
  R, T och V kan köras parallellt (inga beroenden emellan)
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
