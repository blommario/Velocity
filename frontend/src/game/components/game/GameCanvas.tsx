/**
 * GameCanvas — top-level game scene with WebGPU Canvas, physics, map,
 * player controller, effects, and HUD overlays.
 *
 * Depends on: R3F Canvas, Rapier Physics, all game components
 * Used by: App (via screen router)
 */
import { Canvas } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';
import { Physics } from '@react-three/rapier';
import { PlayerController } from './PlayerController';
import { TestMap } from './TestMap';
import { MapLoader } from './map/MapLoader';
import { ScreenShake } from '@engine/effects/ScreenShake';
import { ProjectileRenderer } from './ProjectileRenderer';
import { GhostRenderer } from './GhostRenderer';
import { RemotePlayers } from './RemotePlayers';
import { SpeedTrail, GhostTrail, GrappleBeam, ExplosionManager, CheckpointShimmer, DecalPool, ScopeGlint } from './effects';
import { Viewmodel } from './Viewmodel';
import { PerfMonitor } from '@engine/stores/PerfMonitor';
import { HudOverlay } from '../hud/HudOverlay';
import { DevLogPanel } from '@engine/stores/DevLogPanel';
import { useSettingsStore } from '@game/stores/settingsStore';
import { useGameStore } from '@game/stores/gameStore';
import { PHYSICS } from './physics/constants';
import { devLog } from '@engine/stores/devLogStore';
import { setMaxAnisotropy } from '@game/services/assetManager';
import { ReadySignal } from './ReadySignal';
import { DynamicFov } from './DynamicFov';
import { ScenePostProcessing } from './ScenePostProcessing';

export function GameCanvas() {
  const fov = useSettingsStore((s) => s.fov);
  const mapData = useGameStore((s) => s.currentMapData);
  const mapId = useGameStore((s) => s.currentMapId);

  return (
    <div className="w-screen h-screen relative select-none">
      <Canvas
        gl={async (props) => {
          useGameStore.getState().setLoadProgress(0.1, 'Initializing graphics...');
          devLog.info('Renderer', 'Creating WebGPURenderer...');
          const renderer = new WebGPURenderer({
            canvas: props.canvas as HTMLCanvasElement,
            antialias: true,
          });

          try {
            await renderer.init();
          } catch (err) {
            devLog.error('Renderer', `WebGPU init failed: ${err}`);
            throw err;
          }

          useGameStore.getState().setLoadProgress(0.4, 'Setting up physics...');

          const device = (renderer.backend as any).device as GPUDevice | undefined;
          if (device?.lost) {
            device.lost.then((info) => {
              const msg = `WebGPU device lost: ${info.message} (reason: ${info.reason})`;
              console.error(msg);
              devLog.error('Renderer', msg);
            });
          }

          const aniso = renderer.getMaxAnisotropy();
          setMaxAnisotropy(aniso);
          devLog.success('Renderer', `WebGPU initialized (${renderer.backend.constructor.name}, anisotropy=${aniso})`);
          useGameStore.getState().setLoadProgress(0.6, 'Loading map...');
          return renderer;
        }}
        camera={{ fov, near: 0.1, far: 1000 }}
        shadows
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).requestPointerLock?.()?.catch?.(() => {});
        }}
      >
        <ReadySignal />
        <DynamicFov />
        <ScreenShake
          getIntensity={() => useGameStore.getState().shakeIntensity}
          onDecayed={() => useGameStore.getState().clearShake()}
        />
        <Viewmodel />
        <ScenePostProcessing fogConfig={mapData?.fogOfWar} blocks={mapData?.blocks} />
        <Physics timeStep={PHYSICS.TICK_DELTA} gravity={[0, 0, 0]} interpolate>
          {mapData ? (
            <MapLoader data={mapData} mapId={mapId ?? undefined} />
          ) : (
            <TestMap />
          )}
          <PlayerController />
          <ProjectileRenderer />
          <GhostRenderer />
          <RemotePlayers />
        </Physics>
        <SpeedTrail />
        <GhostTrail />
        <GrappleBeam />
        <ExplosionManager />
        <DecalPool />
        <CheckpointShimmer />
        <ScopeGlint />
        <PerfMonitor />
      </Canvas>
      <HudOverlay />
      <DevLogPanel />
    </div>
  );
}
