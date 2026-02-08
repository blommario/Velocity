import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';
import { Physics } from '@react-three/rapier';
import { MathUtils, PerspectiveCamera } from 'three';
import { PlayerController } from './PlayerController';
import { TestMap } from './TestMap';
import { MapLoader } from './map/MapLoader';
import { ScreenShake } from '../../engine/effects/ScreenShake';
import { useFogOfWar } from '../../engine/effects/useFogOfWar';
import { ProjectileRenderer } from './ProjectileRenderer';
import { GhostRenderer } from './GhostRenderer';
import { PostProcessingEffects } from '../../engine/core/PostProcessingEffects';
import { SpeedTrail, GrappleBeam, ExplosionManager, CheckpointShimmer } from './effects';
import { PerfMonitor } from '../../engine/stores/PerfMonitor';
import { HudOverlay } from '../hud/HudOverlay';
import { DevLogPanel } from '../../engine/stores/DevLogPanel';
import { useSettingsStore } from '../../stores/settingsStore';
import { useGameStore } from '../../stores/gameStore';
import { PHYSICS } from './physics/constants';
import { devLog } from '../../engine/stores/devLogStore';
import { setMaxAnisotropy } from '../../services/assetManager';
import type { FogOfWarConfig } from '../../engine/effects/FogOfWar';

const FOV_SCALING = {
  BASE: 90,
  MAX: 120,
  SPEED_START: 400,
  SPEED_FULL: 800,
  LERP_SPEED: 5,
} as const;

// Pre-allocated view position tuple (mutated in-place, no GC)
const _fogViewPos: [number, number, number] = [0, 0, 0];

/** Wraps PostProcessingEffects with optional fog-of-war driven by camera position. */
function ScenePostProcessing({ fogConfig }: { fogConfig?: Partial<FogOfWarConfig> }) {
  const { camera } = useThree();
  const camPosRef = useRef(_fogViewPos);

  // Update pre-allocated tuple from camera each frame (before useFogOfWar reads it)
  useFrame(() => {
    camPosRef.current[0] = camera.position.x;
    camPosRef.current[1] = camera.position.y;
    camPosRef.current[2] = camera.position.z;
  });

  const enabled = fogConfig !== undefined;
  const { fogTexture, fogUniforms } = useFogOfWar({
    enabled,
    config: fogConfig,
    viewPosition: camPosRef.current,
  });

  return (
    <PostProcessingEffects
      fogTexture={fogTexture}
      fogUniforms={fogUniforms}
    />
  );
}

function DynamicFov() {
  const { camera } = useThree();
  const targetFovRef = useRef(FOV_SCALING.BASE);

  useFrame((_, delta) => {
    const baseFov = useSettingsStore.getState().fov;
    const speed = useGameStore.getState().speed;

    const speedFraction = MathUtils.clamp(
      (speed - FOV_SCALING.SPEED_START) / (FOV_SCALING.SPEED_FULL - FOV_SCALING.SPEED_START),
      0,
      1,
    );
    const maxFov = baseFov + (FOV_SCALING.MAX - FOV_SCALING.BASE);
    targetFovRef.current = baseFov + speedFraction * (maxFov - baseFov);

    const cam = camera as PerspectiveCamera;
    cam.fov = MathUtils.lerp(cam.fov, targetFovRef.current, 1 - Math.exp(-FOV_SCALING.LERP_SPEED * delta));
    cam.updateProjectionMatrix();
  });

  return null;
}

export function GameCanvas() {
  const fov = useSettingsStore((s) => s.fov);
  const mapData = useGameStore((s) => s.currentMapData);
  const mapId = useGameStore((s) => s.currentMapId);

  return (
    <div className="w-screen h-screen relative select-none">
      <Canvas
        gl={async (props) => {
          devLog.info('Renderer', 'Creating WebGPURenderer...');
          const renderer = new WebGPURenderer({
            canvas: props.canvas as HTMLCanvasElement,
            antialias: true,
          });
          await renderer.init();
          const aniso = renderer.getMaxAnisotropy();
          setMaxAnisotropy(aniso);
          devLog.success('Renderer', `WebGPU initialized (${renderer.backend.constructor.name}, anisotropy=${aniso})`);
          return renderer;
        }}
        camera={{ fov, near: 0.1, far: 1000 }}
        shadows
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).requestPointerLock();
        }}
      >
        <DynamicFov />
        <ScreenShake
          getIntensity={() => useGameStore.getState().shakeIntensity}
          onDecayed={() => useGameStore.getState().clearShake()}
        />
        <ScenePostProcessing fogConfig={mapData?.fogOfWar} />
        <Physics
          timeStep={PHYSICS.TICK_DELTA}
          gravity={[0, 0, 0]}
          interpolate
        >
          {mapData ? (
            <MapLoader data={mapData} mapId={mapId ?? undefined} />
          ) : (
            <TestMap />
          )}
          <PlayerController />
          <ProjectileRenderer />
          <GhostRenderer />
        </Physics>
        <SpeedTrail />
        <GrappleBeam />
        <ExplosionManager />
        <CheckpointShimmer />
        <PerfMonitor />
      </Canvas>
      <HudOverlay />
      <DevLogPanel />
    </div>
  );
}
