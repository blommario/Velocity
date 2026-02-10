/**
 * Dev/test map — the default playground for physics, zones, and effects.
 * Layout data in map/testMapConfig.ts, geometry in map/TestMapGeometry.tsx.
 *
 * Depends on: testMapConfig, TestMapGeometry, zone components, engine effects, gameStore, combatStore
 * Used by: GameScreen (when no custom map is loaded)
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Color } from 'three';
import { StartZone } from './zones/StartZone';
import { Checkpoint } from './zones/Checkpoint';
import { FinishZone } from './zones/FinishZone';
import { KillZone } from './zones/KillZone';
import { BoostPad } from './zones/BoostPad';
import { LaunchPad } from './zones/LaunchPad';
import { SpeedGate } from './zones/SpeedGate';
import { AmmoPickup } from './zones/AmmoPickup';
import { GrapplePoint } from './zones/GrapplePoint';
import { TargetDummy } from './TargetDummy';
import { AtmosphericFog } from '@engine/effects/AtmosphericFog';
import { ProceduralSkybox } from '@engine/effects/ProceduralSkybox';
import { InstancedBlocks } from '@engine/rendering';
import { GpuLightSprites } from '@engine/effects/GpuLightSprites';
import { useShadowLight } from '@engine/rendering';
import { WaterSurface } from '@engine/effects/WaterSurface';
import { FogVolume } from '@engine/effects/FogVolume';
import { ParticleEmitter } from '@engine/effects/ParticleEmitter';
import { useGameStore } from '@game/stores/gameStore';
import { useSettingsStore } from '@game/stores/settingsStore';
import { useCombatStore } from '@game/stores/combatStore';
import { devLog } from '@engine/stores/devLogStore';
import { resetPhysicsTickState } from './physics/usePhysicsTick';
import type { MapBlock } from './map/types';
import { TOTAL_CHECKPOINTS, SPAWN_POINT, SPAWN_YAW, BACKGROUND_COLOR, MATERIAL_DEMO_BLOCKS, LIGHT_SPRITES } from './map/testMapConfig';
import { GroundPlane, GridOverlay, SectorMarkers, BeaconPillars, DistanceMarkers, ElevatedPlatforms, StructuralGeometry } from './map/TestMapGeometry';

export function TestMap() {
  const scene = useThree((s) => s.scene);
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);

  useShadowLight({ quality: shadowQuality, position: [60, 100, 40], intensity: 1.4 });

  useEffect(() => {
    devLog.info('Map', 'Loading GridMap...');
    scene.background = new Color(BACKGROUND_COLOR);
    useGameStore.getState().initRun({ checkpointCount: TOTAL_CHECKPOINTS, spawnPoint: SPAWN_POINT, spawnYaw: SPAWN_YAW });
    useCombatStore.getState().resetCombat(5, 3);
    resetPhysicsTickState();
    devLog.success('Map', `GridMap loaded (${TOTAL_CHECKPOINTS} checkpoints)`);
  }, [scene]);

  return (
    <group>
      <GroundPlane />
      <GridOverlay />
      <SectorMarkers />
      <BeaconPillars />
      <DistanceMarkers />
      <ElevatedPlatforms />
      <StructuralGeometry />

      {/* Gameplay Zones */}
      <StartZone position={[0, 2, -3]} size={[6, 4, 4]} />
      <Checkpoint position={[20, 2, -20]} size={[6, 4, 4]} index={0} />
      <Checkpoint position={[50, 2, 0]} size={[6, 4, 4]} index={1} />
      <Checkpoint position={[-15, 8, -15]} size={[6, 4, 4]} index={2} />
      <FinishZone position={[0, 2, 28]} size={[6, 4, 4]} />
      <KillZone position={[0, -55, 0]} size={[300, 10, 300]} />

      {/* Movement items */}
      <BoostPad position={[50.5, 0.1, -15]} direction={[0, 0, 1]} speed={500} />
      <LaunchPad position={[10, 0.15, 15]} direction={[0, 0.6, -0.8]} speed={600} />
      <SpeedGate position={[20, 3, -10]} />
      <AmmoPickup position={[5, 0.5, -8]} type="rocket" amount={3} />
      <AmmoPickup position={[30, 0.5, 5]} type="grenade" amount={2} />
      <GrapplePoint position={[-15, 14, -15]} />
      <GrapplePoint position={[40, 12, -10]} />

      {/* Target Dummies */}
      <TargetDummy position={[10, 0, -5]} id="dummy-1" />
      <TargetDummy position={[20, 0, -15]} id="dummy-2" />
      <TargetDummy position={[-10, 0, 10]} id="dummy-3" />

      {/* Material Demo */}
      <InstancedBlocks blocks={MATERIAL_DEMO_BLOCKS as MapBlock[]} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#87ceeb', '#3a3a3a', 0.4]} />
      <GpuLightSprites lights={LIGHT_SPRITES} />

      {/* Environment */}
      <ProceduralSkybox preset="night" />
      <AtmosphericFog color={BACKGROUND_COLOR} near={100} far={300} />

      {/* Water & Lava */}
      <WaterSurface data={{ position: [30, -0.3, 30], size: [20, 20], type: 'water', flowDirection: [0.7, 0.3], flowSpeed: 0.8, waveHeight: 0.25 }} />
      <WaterSurface data={{ position: [-40, -0.2, -30], size: [12, 12], type: 'lava', waveHeight: 0.15, waveScale: 3.0, flowSpeed: 0.4 }} />

      {/* Fog volumes */}
      <FogVolume data={{ position: [30, 2, 30], shape: 'box', size: [12, 4, 12], color: '#aaccee', density: 0.35, heightFalloff: 0.8 }} />
      <FogVolume data={{ position: [-15, 6, 30], shape: 'sphere', size: [5, 5, 5], color: '#aa66ff', density: 0.5 }} />

      {/* Particle emitters */}
      <ParticleEmitter data={{ position: [-40, 0.5, -30], preset: 'smoke', count: 64, spread: 5, wind: [0.3, 0, 0.1] }} />
      <ParticleEmitter data={{ position: [50.5, 4, 5], preset: 'sparks', count: 24, spread: 0.5 }} />
      <ParticleEmitter data={{ position: [-40, 3, -30], preset: 'ash', count: 96, spread: 8, color: '#ff6622' }} />
    </group>
  );
}
