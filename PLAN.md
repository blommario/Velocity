# VELOCITY — Gameplay & Content Plan

> Engine-arbete (Fas A, G–N) är klart. Fokus nu: gameplay polish, content, ljud, banor, multiplayer.
> ✅ = klart | 🔲 = kvar | 🔧 = pågår

---

## Fas O — Grafik & Visuell Polish
*Engine har shadows (K), SSAO/color grading/film grain (M), decals/particles (N). Kvar: material, miljöeffekter, motion blur.*

**Förutsättning:** Ingen

### O1 — Material Upgrade ✅
- ✅ Per-block PBR i InstancedBlocks — normal map, roughness, metalness per visuell grupp
- ✅ Emissive material stöd — glow-block typ (neon strips, warning lights)
- ✅ Texture blending — TSL blend mellan two texture sets baserat på height/mask

### O2 — Miljöeffekter ✅
- ✅ Vatten/lava-yta — TSL animated plane med refraktion, flow-direction, vertex displacement
- ✅ Volumetrisk dimma — TSL ray march fog volumes (box/sphere), depth-baserad density
- ✅ Rök/eld-emitters — använda particlePresets (smoke/ash) med trigger-zoner i MapData

### O3 — Motion Blur & DoF ✅
- ✅ Camera motion blur via depth-buffer velocity reconstruction — TSL previousViewProjection, 8 samples along velocity vector
- ✅ Valfri DoF — bokeh-stil disc kernel (12 samples), avståndsbaserad CoC
- ✅ Settings-integration: `motionBlur: boolean`, `depthOfField: boolean` i settingsStore

---

## Fas P — Movement & Game Feel ✅
*Kärnrörelse (bhop, strafe, ramp) + avancerad rörelse (wall run, surf, grapple) redan implementerad. Kvar: weapon movement, hit feedback, edge grab.*

**Förutsättning:** Ingen

### P1 — Weapon Movement Mechanics ✅
- ✅ Rocket jump — apply self-damage + knockback impulse från explosion proximity
- ✅ Shotgun jump — hitscan spread med knockback i motsatt riktning (120 force + 100 uplift)
- ✅ Plasma surf — kontinuerlig knockback vid plasma impact (150 force + 0.3x friction)
- ✅ Grenade boost — timed detonation med proximity knockback

### P2 — Hit Feedback & Game Feel ✅
- ✅ Hit marker — visuell X-crosshair + audio feedback vid hitscan/projectile hit
- ✅ Wall sparks — explosion particles + decal vid projectile-wall impact (3 intensities)
- ✅ Kill feed — event log för eliminations (multiplayer-redo, imperative API)
- ✅ Damage numbers — floating text med skadebelopp, ease-out fade + drift uppåt

### P3 — Edge Grab & Mantling ✅
- ✅ Edge detection — dual raycast (forward wall + downward ledge), approach speed check
- ✅ Mantle animation — smoothstep lerp till kantnivå + forward speed boost vid complete
- ✅ Settings toggle: `edgeGrab: boolean` (default on, persisted)

---


---

## Fas R — Banor & Content
*En officiell bana ("First Steps"). Map editor komplett. 

### R3 — Map Editor v2
- 🔲 Modell-placering — browse assets/models/, place + scale + rotate i viewport
- 🔲 Texture picker — per-block texture set selection i properties panel
- 🔲 Decoration objects — non-collidable props (pipes, crates, lights, signs)
- 🔲 Terrain brush — heightmap-baserad markyta (smooth/raise/lower/flatten)



---

## Fas T — Multiplayer & Community
*SSE backend + race rooms + race store finns. Kvar: live race UX, matchmaking, community.*





### T4 — Game Modes
- 🔲 Time Attack — solo timed run (befintligt, men med dedicated mode + constraints)
- 🔲 Ghost Race — race mot sparade ghosts (PB, WR, friends)
- 🔲 Elimination — sista spelaren per checkpoint elimineras
- 🔲 Tag — en spelare "it", fånga andra via proximity
- 🔲 Relay — lag-baserat, spelare turas om per sektion

---

## Beroendeöversikt

```
Fas O (Grafik)              Fas P (Movement)        Fas Q (Audio)
├── O1 Material             ├── P1 Weapon Movement  ├── Q1 Spatial
├── O2 Miljöeffekter        ├── P2 Hit Feedback     ├── Q2 Musik
├── O3 Motion Blur          ├── P3 Edge Grab        ├── Q3 SFX Upgrade
│                           │                       │
│   ← O, P, Q kan köras parallellt →               │
│                                                   │
▼                                                   │
Fas R (Banor) ← O                                  │
├── R1 Officiella banor                             │
├── R2 Teman & Prefabs                              │
├── R3 Editor v2                                    │
│                                                   │
▼                                                   │
Fas S (Gameplay Loop) ← R1                          │
├── S1 Tutorial                                     │
├── S2 Progression                                  │
├── S3 Achievements                                 │
│                                                   │
▼                                                   │
Fas T (Multiplayer) ← R1                            │
├── T1 Live Race Polish                             │
├── T2 Matchmaking                                  │
├── T3 Community                                    │
├── T4 Game Modes                                   │
```

**Rekommenderad ordning:**
1. **O + P + Q** parallellt (inga beroenden emellan)
2. **R** (banor, kräver O för visuell variation)
3. **S + T** parallellt (båda kräver R1 banor)

---

<details>
<summary>Arkiv — Klara faser (A, Engine Extraction, G–N, Fas 12)</summary>

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

## Fas 12 — Multiplayer & SSE ✅
- ✅ Backend SSE endpoints (leaderboard, race, activity)
- ✅ Race rooms API (create, join, ready, start)
- ✅ Frontend SSE client (auto-reconnect)
- ✅ Race store + lobby UI (RoomBrowser, RoomLobby, CountdownOverlay)

</details>
