# VELOCITY — Gameplay & Content Plan

> Engine-arbete (Fas A, G–N) + grafik (O) + movement (P) klart. Kvar: banor, multiplayer, engine-refaktorisering.
> ✅ = klart | 🔲 = kvar | 🔧 = pågår

---

## Fas E — Engine Refaktorisering
*Flytta generiska game-features till engine/ för max återanvändning. Engine ska kunna drivas av vilket spel som helst.*

**Förutsättning:** Ingen (kan köras parallellt med R och T)

### E1 — HUD-komponenter → `engine/hud/`
*Generiska FPS/racing HUD-element med prop injection istället för direkt store-läsning.*
- ✅ `Timer.tsx` — direkt flytt (100% generisk), props: `time`, `running`, `formatter?`
- ✅ `SpeedMeter.tsx` — extrahera tröskelvärden/färger till props
- ✅ `Crosshair.tsx` — gör vapenstilar injicerbara via config-prop
- ✅ `DamageIndicator.tsx` — direkt flytt, props: `hits[]` med riktning+timestamp
- ✅ `HitMarker.tsx` — direkt flytt, props: `onHit` event
- ✅ `DamageNumbers.tsx` — direkt flytt, props: `damages[]`
- ✅ `EventFeed.tsx` — direkt flytt, generisk notifikationslista
- ✅ `ScreenEffects.tsx` — direkt flytt, props: `vignette`, `flash`
- ✅ `ScreenTransition.tsx` — direkt flytt, props: `type`, `duration`
- ✅ `SpeedLines.tsx` — direkt flytt, props: `speed`, `threshold`
- ✅ `TrackProgressBar.tsx` — generisk progress-UI, props: `current`, `total`
- ✅ `CombatHud.tsx` — generisk weapon/ability-UI, props: `weapon`, `ammo`, `health`
- ✅ `DevTweaks.tsx` — direkt flytt
- ✅ `CheckpointCounter.tsx` — generisk progress counter, props: `current`, `total`, `label?`
- ✅ Uppdatera `components/hud/HudOverlay.tsx` att importera från `engine/hud/`
- ✅ `components/hud/` behåller bara: `EndRunModal`, `SplitPopup`, `KillFeed`, `HudOverlay`

### E2 — Stores → `engine/stores/`
*Generiska stores som inte beror på Velocity-specifik logik.*
- ✅ `settingsStore.ts` → `engine/stores/` (redan tillåten i engine, helt generisk)
- ✅ `replayStore.ts` → `engine/stores/` (delta-compression replay, 100% generiskt mönster)
- ✅ `editorStore.ts` → `engine/stores/` (generiskt editor-mönster: objekt, undo/redo, tools)
- ✅ Uppdatera alla imports i game-kod (re-exports från `stores/` för bakåtkompatibilitet)
- ✅ Behåll i `stores/`: `gameStore`, `combatStore`, `authStore`, `raceStore`

### E3 — SensorZone-mönster → `engine/components/`
*Alla 9 zoner följer identiskt mönster. Extrahera generisk bas.*
- ✅ Skapa `engine/components/SensorZone.tsx` — generisk `<SensorZone onEnter onExit position size>`
- ✅ Refaktorisera `Checkpoint.tsx` → tunn wrapper runt SensorZone
- ✅ Refaktorisera `StartZone.tsx` → tunn wrapper
- ✅ Refaktorisera `FinishZone.tsx` → tunn wrapper
- ✅ Refaktorisera `KillZone.tsx` → tunn wrapper
- ✅ Refaktorisera `BoostPad.tsx` → tunn wrapper
- ✅ Refaktorisera `LaunchPad.tsx` → tunn wrapper
- ✅ Refaktorisera `SpeedGate.tsx` → tunn wrapper
- ✅ Refaktorisera `AmmoPickup.tsx` → tunn wrapper
- ✅ `GrapplePoint.tsx` — behållen som-är (inte sensor-zon, använder fysisk collider + useEffect)
- ✅ Barrel export från `engine/components/index.ts`

### E4 — Konfigurerbar Effects
*Gör engine-effects konfigurationsdrivna istället för hårdkodade Velocity-värden.*
- 🔲 `GpuProjectiles.tsx` — färger/sprites via props (ta bort hårdkodade rocket=orange etc.)
- 🔲 `particlePresets.ts` — splitta: generiska (explosion, smoke, dust) kvar i engine, Velocity-specifika (grapple trail, boost) → `components/game/effects/gameParticlePresets.ts`
- 🔲 `MuzzleFlash.tsx` — flytta från engine till `components/game/effects/` (beror på WeaponType)
- 🔲 `useViewmodelAnimation.ts` — gör recoil-mönster injicerbara via config-objekt

### E5 — Rendering & Environment → `engine/effects/`
*Generiska skybox, fog, vatten och visuella effekter utan spellogik.*
- 🔲 `ProceduralSkybox.tsx` → `engine/effects/` (ren Three.js procedural sky, noll game-state)
- 🔲 `HdriSkybox.tsx` → `engine/effects/` (generisk HDRI-loader + blending)
- 🔲 `AtmosphericFog.tsx` → `engine/effects/` (fog color/density/height — helt generisk)
- 🔲 `WaterSurface.tsx` → `engine/effects/` (TSL displacement vatten/lava, config-driven)
- 🔲 `FogVolume.tsx` → `engine/effects/` (volumetrisk fog-region, konfigurerbar)
- 🔲 `ParticleEmitter.tsx` → `engine/effects/` (generisk emitter med preset-config)
- 🔲 `GrappleBeam.tsx` → `engine/effects/LineRenderEffect.tsx` (generisk linje/stråle-rendering)
- 🔲 `CheckpointShimmer.tsx` → `engine/effects/ObjectHighlight.tsx` (generisk shimmer/highlight)
- 🔲 `SpeedTrail.tsx` → `engine/effects/` (extrahera config, props: `speed`, `threshold`, `colors`)
- 🔲 `wallSparks.ts` → konsolidera in i `engine/effects/` som impact-particle-helper

### E6 — Cleanup & Map Renderers
*Ta bort deprecated kod. Flytta generiska map-renderers.*
- 🔲 Ta bort `DynamicPointLights.tsx` (deprecated, ersatt av GpuLightSprites)
- 🔲 `InstancedBlocks.tsx` → `engine/rendering/` (generisk instanced block-renderer med culling+LOD)
- 🔲 `InstancedSurfRamps.tsx` → `engine/rendering/` (generisk instanced ramp-renderer)
- 🔲 `HeightmapTerrain.tsx` → `engine/rendering/` (generisk heightmap terrain-renderer)
- 🔲 `ModelBlock.tsx` → `engine/rendering/` (generisk glTF model-placering)
- 🔲 `ProceduralBlockGroup.tsx` → `engine/rendering/` (generisk procedural geometry-grupp)
- 🔲 `blockUtils.ts` → `engine/rendering/` (material/physics setup-helpers)
- 🔲 `RtsCameraController.tsx` → ta bort eller flytta till `engine/input/` (tunn wrapper runt useRtsCamera)
- 🔲 Barrel exports från `engine/effects/index.ts` och `engine/rendering/index.ts`

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

## Beroendeöversikt

```
Fas E (Engine Refaktorisering)
├── E1 HUD → engine/hud/              (14 komponenter)
├── E2 Stores → engine/stores/        (3 stores)
├── E3 SensorZone → engine/components/ (9 zoner + bas)
├── E4 Konfigurerbar Effects           (4 filer)
├── E5 Rendering & Environment         (10 filer → engine/effects/)
├── E6 Cleanup & Map Renderers         (8 filer + 1 deprecated bort)

Fas R (Banor)
├── R3 Editor v2

Fas T (Multiplayer)
├── T4 Game Modes

E, R och T kan köras parallellt (inga beroenden emellan).
E1–E6 kan köras i valfri ordning men E1 först rekommenderas (störst vinst).
E5 bör köras före E6 (environment-effects används av map-renderers).
```

---

<details>
<summary>Arkiv — Klara faser (A, Engine Extraction, G–P, Fas 12)</summary>

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

</details>
