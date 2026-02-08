# VELOCITY — Engine & Gameplay Plan

> Fokus: Slutför engine-systems (J–N) innan game-specifika features (B–F).
> Ljud (Fas D) är **on hold**. Gameplay-faser **parkerade** tills engine är klar.
> ✅ = klart | 🔲 = kvar | 🔧 = pågår

---

## Fas J — Animation & Asset Upgrade
*Utan animation kan vi inte ha weapon viewmodels, animerade miljöobjekt eller karaktärer.*

**Förutsättning:** Ingen (asset pipeline redan klar i Fas A)

### J1 — Animation Extraction i Asset Pipeline
- 🔲 Utöka `services/assetManager.ts` — spara `gltf.animations` (AnimationClip[]) i ny `animationCache`
- 🔲 Ny export `loadModelWithAnimations(url)` → `{ scene: Group, animations: AnimationClip[] }`
- 🔲 Ny typ `ModelAsset = { scene: Group; animations: AnimationClip[] }`

### J2 — Animation Playback Hook
*React hook som wrapprar Three.js AnimationMixer.*

**Förutsättning:** J1

- 🔲 `engine/effects/useAnimation.ts` — hook med input: Group ref + AnimationClip[]
- 🔲 Output: `{ play(name), stop(), crossFade(from, to, duration), mixer }`
- 🔲 Uppdatering via `useFrame` delta, stödjer loop/clamp/ping-pong

### J3 — Animated Object Component
*Generisk komponent för animerade modeller i scenen.*

**Förutsättning:** J1, J2

- 🔲 `engine/effects/AnimatedModel.tsx` — props: `url`, `animation`, `loop`, `speed`, `onComplete`
- 🔲 Använder J1 (asset loading) + J2 (playback) internt

---

## Fas K — Shadows & Lighting Quality
*Inga shadows just nu. En persistent DirectionalLight triggar aldrig LightsNode recompile (light count ändras inte). Point lights fortsätter med tile-clustered emissive sprites.*

**Förutsättning:** Ingen

### K1 — Directional Shadow (Single Light)
- 🔲 `engine/rendering/useShadowLight.ts` — hook: skapar persistent DirectionalLight + shadow config
- 🔲 `engine/rendering/shadowConfig.ts` — quality presets (mapSize: 512/1024/2048/4096, bias, cascade distances)
- 🔲 Shadow quality kopplad till `settingsStore.shadows` + `qualityPreset`
- 🔲 CSM via Three.js `CSMShadowNode` om tillgängligt, annars standard shadow map

### K2 — Shadow Quality Settings
- 🔲 Utöka `stores/settingsStore.ts` — `shadowQuality: 'off' | 'low' | 'medium' | 'high'`
- 🔲 Koppla till shadow map resolution och cascade count
- 🔲 Default: `'medium'` vid qualityPreset high, `'off'` vid low

---

## Fas L — Viewmodel & First-Person Rendering
*Weapon viewmodel renderas i en separat scene/kamera ovanpå huvudscenen — standard FPS-teknik.*

**Förutsättning:** Fas J (animation behövs för viewmodel)

### L1 — Viewmodel Render Layer
- 🔲 `engine/rendering/ViewmodelLayer.tsx` — `createPortal` till separat scene
- 🔲 Egen kamera (viewmodel FOV ~70° vs gameplay ~100°)
- 🔲 Extra `pass()` i PostProcessing pipeline efter scenePass
- 🔲 Depth clear mellan passes — viewmodel alltid framför world geometry

### L2 — Viewmodel Animation Support
- 🔲 `engine/rendering/useViewmodelAnimation.ts` — hook för viewmodel-specifik animation
- 🔲 Stödjer: idle sway, bob (kopplat till velocity), recoil, draw/holster
- 🔲 Input via props (velocity, isFiring, isDrawing) — INTE game store

### L3 — Muzzle Flash
- 🔲 `engine/effects/MuzzleFlash.tsx` — GPU sprite burst (återanvänder GpuParticles-mönster)
- 🔲 Emissive ×8.0 + bloom, 2-3 frames duration, additive blending

---

## Fas M — Post-Processing Pipeline
*Utöka PostProcessing med SSAO, color grading, och valfria effekter.*

**Förutsättning:** Ingen (men bäst efter K då SSAO drar nytta av depth/normals)

### M1 — SSAO (Screen-Space Ambient Occlusion)
- 🔲 Använd `GTAONode` från `three/addons` (WebGPU-ready)
- 🔲 Lägg till MRT `normalView` output från scenePass i `PostProcessingEffects.tsx`
- 🔲 Kopplad till `settingsStore` toggle (`ssao: boolean`)

### M2 — Color Grading & Film Effects
- 🔲 Color grading via TSL: exposure, contrast, saturation, color temperature
- 🔲 Valfri chromatic aberration (TSL UV offset per kanal)
- 🔲 Valfri film grain (TSL noise)
- 🔲 Alla effekter toggle-bara via settingsStore

### M3 — PostFX Settings
- 🔲 Utöka `stores/settingsStore.ts` — `ssao`, `colorGrading`, `filmGrain`, `chromaticAberration` booleans
- 🔲 Koppla till kvalitetspreset (ultra → alla på, low → alla av)

---

## Fas N — Decals & Particle Variety
*Impact marks och partikelvariation ger visual polish.*

**Förutsättning:** Ingen

### N1 — Decal System
- 🔲 `engine/effects/DecalPool.tsx` — poolad decal-manager (max ~64 aktiva)
- 🔲 Mesh-baserad decal projection (Three.js `DecalGeometry` eller TSL-baserad)
- 🔲 Input: position, normal, size, texture/color, lifetime
- 🔲 Auto-fade + recycle äldsta vid pool exhaustion

### N2 — Particle Presets
- 🔲 `engine/effects/particlePresets.ts` — konfigurationsobjekt per partikeltyp
- 🔲 Presets: `smoke`, `sparks`, `dust`, `debris`, `trail`, `ambient` (snö/ash/pollen)
- 🔲 Varje preset: count, lifetime, speed, spread, gravity, color, blend mode, sprite
- 🔲 Återanvänder GpuParticles-systemet med preset som input
- 🔲 `engine/effects/EnvironmentalParticles.tsx` — komponent för ambient particles (prop-driven)

---

## Beroendeöversikt

```
Fas J (Animation)           Fas K (Shadows)
├── J1 Asset Pipeline       ├── K1 Directional Shadow
├── J2 Playback Hook ← J1  ├── K2 Shadow Settings
├── J3 Animated Model ← J2 │
│                           │    ← kan köras parallellt →
▼                           │
Fas L (Viewmodel) ← J      │
├── L1 Render Layer         │
├── L2 Animation ← L1      │
├── L3 Muzzle Flash         │
                            │
Fas M (PostFX)              │   Fas N (Decals & Particles)
├── M1 SSAO                 │   ├── N1 Decal System
├── M2 Color Grading        │   ├── N2 Particle Presets
├── M3 Settings             │
                            │
    ← M + N kan köras parallellt, bäst efter K →
```

**Rekommenderad ordning:**
1. **J + K** parallellt (inga beroenden emellan)
2. **L** (kräver J)
3. **M + N** parallellt (visual polish)

---

## Parkerat — Velocity Gameplay (framtida faser)

Dessa faser är **inte borttagna**, bara parkerade tills engine-arbetet (J–N) är klart:

### Fas B — Grafik & Visuell Kvalitet
- B1 Material Upgrade (normal maps, roughness/metalness, emissive)
- B2 Lighting Upgrade (SSR, area lights, light probes, volumetric)
- B3 Miljöeffekter (vatten/lava, rök/dimma, damm/gnistor)
- B4 Kamera & Post-Processing (motion blur, DoF)

### Fas C — Physics & Movement Feel
- C1 Kärnrörelse (bhop, air strafe, landing, ramp, slope)
- C2 Avancerad Rörelse (wall run, surf, slide chain, grapple, edge grab)
- C3 Vapenrörelse (rocket jump, shotgun jump, knife lunge, plasma surf, grenade boost)
- C4 Game Feel (weapon viewmodel, muzzle flash, impact particles, wall sparks, hit marker)

### Fas D — Ljud & Audio (ON HOLD)
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

---

<details>
<summary>Arkiv — Klara faser (A, Engine Extraction, G, H, I)</summary>

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

## Fas G — GPU Performance & Memory ✅
*Reducera draw calls, fixa minnesläckor, optimera Rapier physics, förbered för stora världar.*

**Förutsättning:** Fas A (asset pipeline klar)

### G1 — Collider Merging ✅
- ✅ `engine/physics/colliderBatch.ts` — `batchStaticColliders(blocks)` → `ColliderBatchGroup[]`
- ✅ `components/game/map/InstancedBlocks.tsx` — batchade grupper
- ✅ Exportera från `engine/physics/index.ts`

### G2 — ModelBlock Dispose & Cache Eviction ✅
- ✅ `engine/rendering/dispose.ts` — `disposeSceneGraph(obj)`
- ✅ `components/game/map/ModelBlock.tsx` — dispose i useEffect cleanup
- ✅ `services/assetManager.ts` — `clearAssetCache()`
- ✅ `components/game/map/MapLoader.tsx` — cache cleanup vid kartbyte

### G3 — DynamicPointLights → TSL Sprites ✅
- ✅ `engine/effects/GpuLightSprites.tsx` — `instancedDynamicBufferAttribute` + `SpriteNodeMaterial` × 6.0
- ✅ `components/game/map/MapLoader.tsx` — ersätt `<EmissivePointLight>` med `<GpuLightSprites>`
- ✅ Deprecera `components/game/DynamicPointLights.tsx`

### G4 — Spatial Partitioning (Grid Cells) ✅
- ✅ `engine/rendering/SpatialGrid.ts` — `insert()`, `querySphere()`, `getCellsInRadius()`
- ✅ `engine/rendering/useSpatialCulling.ts` — aktiva celler baserat på kameraposition
- ✅ `components/game/map/InstancedBlocks.tsx` — filtrera synliga block (500+ block)

### G5 — LOD (Level of Detail) ✅
- ✅ `engine/rendering/LodManager.ts` — trösklar + hjälpfunktioner
- ✅ `components/game/map/InstancedBlocks.tsx` — dubbla InstancedMesh (nära/fjärran)
- ✅ `components/game/map/ModelBlock.tsx` — avståndbaserad laddning

---

## Fas H — Camera, Interaction & Rendering ✅
*RTS-kamera, GPU picking, instansad rendering, grid-snapping.*

### H1 — RTS-kamera (Engine-Level) ✅
- ✅ `engine/input/useRtsCamera.ts` — hook med config-props
- ✅ `engine/input/useRtsInput.ts` — input utan pointer lock
- ✅ `stores/settingsStore.ts` — RTS-inställningar
- ✅ `components/game/RtsCameraController.tsx` — game-komponent

### H2 — GPU Picking ✅
- ✅ `engine/rendering/GpuPicker.ts` — pick render target, ID-tilldelning
- ✅ `engine/rendering/usePickable.ts` — hook (24-bit, 16.7M objekt)

### H3 — SurfRamp Instancing ✅
- ✅ `components/game/map/InstancedSurfRamps.tsx` — gruppera per färg
- ✅ `components/game/map/MapLoader.tsx` — ersätt per-ramp rendering

### H4 — Snap-to-Grid ✅
- ✅ `engine/rendering/snapToGrid.ts` — `snapToGrid()`, `snapPosition()`, `snapRotation()`

---

## Fas I — Atmosphere & D&D Systems ✅
*Compute shader lighting, fog-of-war, fysiska tärningar.*

### I1 — Clustered TSL Lighting (100+ ljus) ✅
- ✅ `engine/rendering/ClusteredLights.ts` — `selectNearestLights()` brute-force sort
- ✅ `engine/rendering/useClusteredLighting.ts` — PointLight pool (8 st) + LightsNode ~4Hz
- ✅ `engine/rendering/lightMaterial.ts` — lightsNode helpers
- ✅ Integration: MapLoader → useClusteredLighting → InstancedBlocks
- ✅ Steg 2: Full tile clustering (512 lights, 20×12 tiles, 32/tile, GPU compute binning, Frostbite PBR)

### I2 — Line of Sight / Fog of War ✅
- ✅ `engine/effects/FogOfWar.ts` — CPU visibility grid (128×128)
- ✅ `engine/effects/useFogOfWar.ts` — DataTexture (R8) ~4Hz
- ✅ `engine/core/PostProcessingEffects.tsx` — FoW post-processing pass
- ✅ Steg 2: GPU compute ray march mot heightmap (DDA, dual-path)

### I3 — Physical Dice ✅
- ✅ `engine/effects/diceGeometry.ts` — polyeder-generatorer (d4–d20) + cache
- ✅ `engine/effects/PhysicsDice.tsx` — Rapier dynamic bodies, settling, face-normal resultat

</details>
