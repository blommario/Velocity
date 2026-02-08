# VELOCITY — Engine & Gameplay Plan

> Fokus: Engine GPU-optimering, nya engine-systems, framtida spelstöd (D&D/RTS).
> Velocity-specifik gameplay (B-F) **parkerad** tills engine är klar.
> ✅ = klart | 🔲 = kvar | 🔧 = pågår

---

## Fas A — Asset Pipeline & glTF Loading ✅
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
- ✅ **Quaternius Modular Sci-Fi MEGAKIT** — 190 glTF modeller (CC0)
- ✅ **Kenney Space Kit** — 153 FBX modeller (CC0)
- ✅ **Poly Haven Night HDRI** — `satara_night_2k.hdr` + `dikhololo_night_2k.hdr` (CC0, 2K)
- ✅ **3dtextures.me Sci-Fi Panels** — 6 PBR texture-set (CC0)
- ✅ **ambientCG Metal/Concrete** — `metal-009` + `concrete-034` PBR texturer (CC0, 1K)
- ✅ Organisera assets i `frontend/public/assets/` — models/, textures/, hdri/

---

## Engine Extraction ✅
*Extraherat generisk, återanvändbar engine-kod till `src/engine/`.*

- ✅ Core — `setup-webgpu.ts`, `PostProcessingEffects.tsx` → `engine/core/`
- ✅ Physics — `useMovement.ts`, `useAdvancedMovement.ts`, `ENGINE_PHYSICS` konstanter → `engine/physics/`
- ✅ Input — `useInputBuffer.ts` → `engine/input/`
- ✅ Audio — `AudioManager.ts` → `engine/audio/`
- ✅ Effects — `GpuParticles.tsx`, `ExplosionEffect.tsx`, `ScreenShake.tsx` (prop-injected) → `engine/effects/`
- ✅ Stores — `devLogStore.ts`, `PerfMonitor.tsx`, `DevLogPanel.tsx` → `engine/stores/`
- ✅ Types — `InputState`, `MovementState`, map-typer (`MapBlock`, `Vec3`, etc.) → `engine/types/`
- ✅ Barrel exports — `engine/index.ts` + per-modul index
- ✅ CLAUDE.md uppdaterad med engine/game boundary-regler

---

## Fas G — GPU Performance & Memory
*Reducera draw calls, fixa minnesläckor, optimera Rapier physics, förbered för stora världar.*

**Förutsättning:** Fas A (asset pipeline klar)

### G1 — Collider Merging ✅
*Slå ihop statiska block-colliders till 1-2 RigidBodies (en per shape-typ) med multipla child-colliders. ~200 Rapier-öar → ~2.*

- ✅ `engine/physics/colliderBatch.ts` — Ren funktion `batchStaticColliders(blocks)` → `ColliderBatchGroup[]`
- ✅ `components/game/map/InstancedBlocks.tsx` — Ersätt per-block `<RigidBody>` med batchade grupper
- ✅ Exportera från `engine/physics/index.ts`

### G2 — ModelBlock Dispose & Cache Eviction ✅
*Full Three.js dispose vid unmount + assetManager cache-rensning vid kartbyte. Förhindrar GPU-minnesläckor.*

- ✅ `engine/rendering/dispose.ts` — `disposeSceneGraph(obj)` traverserar och disposar geometrier, material, texturer
- ✅ `components/game/map/ModelBlock.tsx` — Anropa `disposeSceneGraph` i useEffect cleanup
- ✅ `services/assetManager.ts` — `clearAssetCache()` anropar dispose på cachade modeller
- ✅ `components/game/map/MapLoader.tsx` — Trigga cache cleanup vid kartbyte

### G3 — DynamicPointLights → TSL Sprites ✅
*Ersätt individuella `<pointLight>` (11+ shadow passes) med en enda instansad GpuLightSprites (1 draw call). Följer GpuProjectiles-mönstret.*

- ✅ `engine/effects/GpuLightSprites.tsx` — `instancedDynamicBufferAttribute` + `SpriteNodeMaterial` × 6.0 + bloom
- ✅ `components/game/map/MapLoader.tsx` — Ersätt `<EmissivePointLight>` med `<GpuLightSprites>`
- ✅ Deprecera `components/game/DynamicPointLights.tsx`

### G4 — Spatial Partitioning (Grid Cells)
*Dela upp kartan i 2D-celler (XZ-plan). Foundation för LOD, fog-of-war, stora världar.*

- 🔲 `engine/rendering/SpatialGrid.ts` — Ren datastruktur: `insert()`, `querySphere()`, `getCellsInRadius()`
- 🔲 `engine/rendering/useSpatialCulling.ts` — React-hook, returnerar aktiva celler baserat på kameraposition
- 🔲 `components/game/map/InstancedBlocks.tsx` — Filtrera synliga block per aktiv cell (vid 500+ block)

### G5 — LOD (Level of Detail)
*Avståndbaserat geometribyte: nära=full detail, medel=förenklad, långt=dölj.*

**Förutsättning:** G4

- 🔲 `engine/rendering/LodManager.ts` — Trösklar (FULL_DETAIL: 100, SIMPLIFIED: 250, HIDDEN: 500) och hjälpfunktioner
- 🔲 `components/game/map/InstancedBlocks.tsx` — Dubbla InstancedMesh per grupp (nära/fjärran)
- 🔲 `components/game/map/ModelBlock.tsx` — Avståndbaserad laddning/urladdning

---

## Fas H — Camera, Interaction & Rendering
*RTS-kamera, GPU picking, instansad rendering, grid-snapping.*

**Förutsättning:** Ingen (kan köras parallellt med G)

### H1 — RTS-kamera (Engine-Level)
*Top-down/vinklad kamera med pan (WASD/middle-drag), rotation (right-drag/Q/E), zoom (scroll). Ingen pointer lock. Orbitar runt fokuspunkt på markplanet.*

- 🔲 `engine/input/useRtsCamera.ts` — Hook med config-props (minZoom, maxZoom, panSpeed, rotateSpeed, bounds, groundPlaneY)
- 🔲 `engine/input/useRtsInput.ts` — Input utan pointer lock (edge-scroll, drag-pan, drag-rotate, click-select)
- 🔲 `stores/settingsStore.ts` — Lägg till RTS-inställningar (panSpeed, zoomSpeed, edgeScrollEnabled)
- 🔲 Game-komponent som växlar FPS/RTS-kamera baserat på lägesflagga

### H2 — GPU Picking
*Selektera 3D-objekt via GPU color picking. 1×1 pixel render target, unik färg-ID per objekt, icke-blockerande avläsning.*

**Förutsättning:** H1 (kräver musklick utan pointer lock)

- 🔲 `engine/rendering/GpuPicker.ts` — Pick render target, ID-tilldelning, avläsning via `readRenderTargetPixelsAsync`
- 🔲 `engine/rendering/usePickable.ts` — Hook för att registrera mesh som pickable (max 16.7M objekt, 24-bit)

### H3 — SurfRamp Instancing
*Batcha surf ramps till InstancedMesh. Samma mönster som InstancedBlocks.*

**Förutsättning:** G1 (collider-merging mönster)

- 🔲 `components/game/map/InstancedSurfRamps.tsx` — Gruppera ramps per färg, instansad wedge-geometri
- 🔲 `components/game/map/MapLoader.tsx` — Ersätt per-ramp `BlockRenderer` med `InstancedSurfRamps`

### H4 — Snap-to-Grid
*Rena matematikfunktioner för grid-snapping. Inga beroenden.*

- 🔲 `engine/rendering/snapToGrid.ts` — `snapToGrid(value, gridSize)`, `snapPosition(pos, gridSize)`, `snapRotation(angle, step)`

---

## Fas I — Atmosphere & D&D Systems
*Compute shader lighting, fog-of-war, fysiska tärningar.*

**Förutsättning:** Fas G (GPU performance foundation) + Fas H (RTS camera + GPU picking)

### I1 — Clustered TSL Lighting (100+ ljus)
*TSL fragment shader med N närmaste ljus per objekt (steg 1: capped 8-16). Möjliggör hundratals facklor/magiska ljus.*

**Förutsättning:** G3, G4

- 🔲 `engine/rendering/ClusteredLights.ts` — Ljusbuffert + compute shader för binning
- 🔲 `engine/rendering/lightMaterial.ts` — TSL material-nod som läser ljusbuffert
- 🔲 Steg 2 (framtida): Full clustered shading med screen-space tiles för 500+ ljus

### I2 — Line of Sight / Fog of War
*Compute shader fog-of-war med 2D visibility-textur. Tre states: HIDDEN, PREVIOUSLY_SEEN, VISIBLE.*

**Förutsättning:** G4, I1

- 🔲 `engine/effects/FogOfWar.ts` — Compute shader + 512×512 visibility textur
- 🔲 `engine/core/PostProcessingEffects.tsx` — Fog-of-war som post-processing pass (valfritt)
- 🔲 Enkel version: avståndskontroll. Avancerad: ray march mot heightmap för line-of-sight

### I3 — Physical Dice
*Rapier dynamic bodies som tärningar (d4–d20). Procedurella polyeder-geometrier. Resultatavläsning via face-normal vs world-up vid settling.*

**Förutsättning:** G1

- 🔲 `engine/effects/PhysicsDice.ts` — Tärningsfysik, impulse, settling-detection, resultatavläsning
- 🔲 `engine/effects/diceGeometry.ts` — Procedurella polyeder-generatorer (d4, d6, d8, d10, d12, d20)

---

## Beroendeöversikt

```
Fas G (GPU Performance)
├── G1 Collider Merging ──────────┬──→ H3 SurfRamp Instancing
│                                 └──→ I3 Physical Dice
├── G2 ModelBlock Dispose         (oberoende)
├── G3 PointLights → TSL ────────┬──→ I1 Clustered Lighting
│                                 │
├── G4 Spatial Partitioning ──────┼──→ G5 LOD
│                                 ├──→ I1 Clustered Lighting
│                                 └──→ I2 Fog of War ← I1
└── G5 LOD ← G4

Fas H (Camera & Interaction)
├── H1 RTS-kamera ───────────────→ H2 GPU Picking
├── H3 SurfRamp Instancing ← G1
└── H4 Snap-to-Grid              (oberoende)

Fas I (Atmosphere & D&D)
├── I1 Clustered Lighting ← G3, G4
├── I2 Fog of War ← G4, I1
└── I3 Physical Dice ← G1
```

**Rekommenderad prioritetsordning:**
1. **G1** — Collider Merging (omedelbar prestandavinst)
2. **G2** — ModelBlock Dispose (minnesläcka-fix)
3. **G3** — PointLights → TSL Sprites (draw call-reduktion)
4. **H4** — Snap-to-Grid (enkel utility)
5. **G4** — Spatial Partitioning (foundation)
6. **H1** — RTS-kamera (låser upp interaktion)
7. **G5** — LOD (kräver G4)
8. **H3** — SurfRamp Instancing (kräver G1)
9. **H2** — GPU Picking (kräver H1)
10. **I3** — Physical Dice (kräver G1)
11. **I1** — Clustered Lighting (kräver G3+G4, mest komplex)
12. **I2** — Fog of War (kräver G4+I1)

---

## Parkerat — Velocity Gameplay (framtida faser)

Dessa faser är **inte borttagna**, bara parkerade tills engine-arbetet är klart:

### Fas B — Grafik & Visuell Kvalitet
- B1 Material Upgrade (normal maps, roughness/metalness, emissive)
- B2 Lighting Upgrade (SSR, area lights, light probes, volumetric)
- B3 Miljöeffekter (vatten/lava, rök/dimma, damm/gnistor, decals)
- B4 Kamera & Post-Processing (SSAO, motion blur, chromatic aberration, color grading, DoF)

### Fas C — Physics & Movement Feel
- C1 Kärnrörelse (bhop, air strafe, landing, ramp, slope)
- C2 Avancerad Rörelse (wall run, surf, slide chain, grapple, edge grab)
- C3 Vapenrörelse (rocket jump, shotgun jump, knife lunge, plasma surf, grenade boost)
- C4 Game Feel (weapon viewmodel, muzzle flash, impact particles, wall sparks, hit marker)

### Fas D — Ljud & Audio
- D1 Sound Effects (CC0 SFX, sample migration)
- D2 Spatial Audio (3D positionering, reverb, doppler)
- D3 Musik & Ambience (ambient loops, dynamisk musik, menu, stingers)

### Fas E — Banor & Level Design
- E1 Uppgradera befintliga banor (First Steps, Cliffside, Neon District, Gauntlet, Skybreak)
- E2 Nya banor (Orbital, Molten Core, Speedway, Vertigo, Frostbite)
- E3 Map Editor v2 (prefabs, modell-placering, texture picker, decorations)

### Fas F — Gameplay Loop Polish
- F1 Tutorial & Onboarding
- F2 Replay & Ghost System
- F3 End-of-Run Experience

### Multiplayer & Community
- Multiplayer — Live race, ghost race, SSE broadcasting
- Matchmaking — ELO, ranked, seasons
- Socialt — Friends, activity feed, achievements
- Game Modes — Elimination, tag, relay, time attack
- Community — Map rating, tags, featured maps, comments
