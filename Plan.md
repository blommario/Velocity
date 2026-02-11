# Plan — Doc Comments

Lägg till top-of-file JSDoc på alla TS/TSX som saknar det.
Format:
```ts
/**
 * Description
 *
 * Depends on: XXX
 * Used by: YYY
 */
```

Exkluderat: rena barrel index-filer (bara `export`-rader), `.d.ts`, testfiler.

---

## Engine

### engine/audio
- ✅ `AudioManager.ts`

### engine/components
- ✅ `SensorZone.tsx`

### engine/core
- ✅ `setup-webgpu.ts`

### engine/effects
- ✅ `ScreenShake.tsx`
- ✅ `spawnImpactEffects.ts`

### engine/hud
- ✅ `CheckpointCounter.tsx`
- ✅ `CombatHud.tsx`
- ✅ `Crosshair.tsx`
- ✅ `DamageIndicator.tsx`
- ✅ `DamageNumbers.tsx`
- ✅ `DevTweaks.tsx`
- ✅ `EventFeed.tsx`
- ✅ `ScreenEffects.tsx`
- ✅ `ScreenTransition.tsx`
- ✅ `SpeedLines.tsx`
- ✅ `SpeedMeter.tsx`
- ✅ `StanceIndicator.tsx`
- ✅ `Timer.tsx`
- ✅ `TrackProgressBar.tsx`

### engine/input
- ✅ `useInputBuffer.ts`

### engine/networking
- ✅ `index.ts`

### engine/physics
- ✅ `colliderBatch.ts`
- ✅ `index.ts`
- ✅ `useAdvancedMovement.ts`
- ✅ `useMovement.ts`

### engine/rendering
- ✅ `dispose.ts`
- ✅ `heightmapGeometry.ts`
- ✅ `HeightmapTerrain.tsx`
- ✅ `index.ts`
- ✅ `InstancedSurfRamps.tsx`
- ✅ `ModelBlock.tsx`
- ✅ `ProceduralBlockGroup.tsx`
- ✅ `shadowConfig.ts`
- ✅ `snapToGrid.ts`
- ✅ `useShadowLight.ts`

### engine/stores
- ✅ `devLogStore.ts`
- ✅ `editorStore.ts`
- ✅ `index.ts`
- ✅ `PerfMonitor.tsx`
- ✅ `replayStore.ts`
- ✅ `settingsStore.ts`

### engine/types
- ✅ `index.ts`
- ✅ `map.ts`
- ✅ `physics.ts`

---

## Game

### game/components/editor
- 🔲 `EditorCamera.tsx`
- 🔲 `EditorGizmo.tsx`
- 🔲 `EditorViewport.tsx`
- 🔲 `MapEditor.tsx`
- 🔲 `ObjectPalette.tsx`
- 🔲 `SpawnMarker.tsx`

### game/components/game
- 🔲 `AtmosphericFog.tsx`
- 🔲 `GhostRenderer.tsx`
- 🔲 `HdriSkybox.tsx`
- 🔲 `PlayerController.tsx`
- 🔲 `ProceduralSkybox.tsx`

### game/components/game/effects
- 🔲 `CheckpointShimmer.tsx`
- 🔲 `GrappleBeam.tsx`
- 🔲 `ScopeGlint.tsx`
- 🔲 `SpeedTrail.tsx`
- 🔲 `wallSparks.ts`

### game/components/game/environment
- 🔲 `FogVolume.tsx`
- 🔲 `ParticleEmitter.tsx`
- 🔲 `WaterSurface.tsx`

### game/components/game/map/official
- 🔲 `firstSteps.ts`
- 🔲 `hillRun.ts`

### game/components/game/physics
- 🔲 `constants.ts`
- 🔲 `scratch.ts`
- 🔲 `types.ts`
- 🔲 `usePhysicsTick.ts`

### game/components/menu
- 🔲 `AuthScreen.tsx`
- 🔲 `LoadingScreen.tsx`
- 🔲 `PlayerProfile.tsx`
- 🔲 `SystemStatus.tsx`

### game/components/menu/race
- 🔲 `CountdownOverlay.tsx`
- 🔲 `RoomBrowser.tsx`

### game/hooks
- 🔲 `useTexturedMaterial.ts`

### game/services
- 🔲 `api.ts`
- 🔲 `assetManager.ts`
- 🔲 `leaderboardService.ts`
- 🔲 `mapService.ts`
- 🔲 `raceService.ts`
- 🔲 `replayService.ts`
- 🔲 `runService.ts`
- 🔲 `sseClient.ts`
- 🔲 `types.ts`

### game/stores
- 🔲 `authStore.ts`
- 🔲 `combatStore.ts`
- 🔲 `editorStore.ts`
- 🔲 `gameStore.ts`
- 🔲 `replayStore.ts`
- 🔲 `settingsStore.ts`

### game/types
- 🔲 `game.ts`

---

## Root
- 🔲 `App.tsx`
- 🔲 `main.tsx`
