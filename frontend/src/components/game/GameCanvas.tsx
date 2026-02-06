import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { MathUtils, PerspectiveCamera } from 'three';
import { PlayerController } from './PlayerController';
import { TestMap } from './TestMap';
import { ScreenShake } from './ScreenShake';
import { ProjectileRenderer } from './ProjectileRenderer';
import { HudOverlay } from '../hud/HudOverlay';
import { useSettingsStore } from '../../stores/settingsStore';
import { useGameStore } from '../../stores/gameStore';
import { PHYSICS } from './physics/constants';

const FOV_SCALING = {
  BASE: 90,
  MAX: 120,
  SPEED_START: 400,
  SPEED_FULL: 800,
  LERP_SPEED: 5,
} as const;

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

  return (
    <div className="w-screen h-screen relative select-none">
      <Canvas
        camera={{ fov, near: 0.1, far: 1000 }}
        shadows
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).requestPointerLock();
        }}
      >
        <DynamicFov />
        <ScreenShake />
        <Physics
          timeStep={PHYSICS.TICK_DELTA}
          gravity={[0, 0, 0]}
          interpolate
        >
          <PlayerController />
          <ProjectileRenderer />
          <TestMap />
        </Physics>
      </Canvas>
      <HudOverlay />
    </div>
  );
}
