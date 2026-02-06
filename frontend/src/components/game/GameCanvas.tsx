import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PlayerController } from './PlayerController';
import { TestMap } from './TestMap';
import { HudOverlay } from '../hud/HudOverlay';
import { useSettingsStore } from '../../stores/settingsStore';
import { PHYSICS } from './physics/constants';

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
        <Physics
          timeStep={PHYSICS.TICK_DELTA}
          gravity={[0, 0, 0]}
          interpolate
        >
          <PlayerController />
          <TestMap />
        </Physics>
      </Canvas>
      <HudOverlay />
    </div>
  );
}
