import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Euler } from 'three';
import { useReplayStore } from '../../stores/replayStore';
import { useGameStore, RUN_STATES } from '../../stores/gameStore';
import { PHYSICS } from './physics/constants';

const GHOST_COLOR = '#4488ff';
const GHOST_OPACITY = 0.35;

export function GhostRenderer() {
  const meshRef = useRef<Mesh>(null);
  const hasGhost = useReplayStore((s) => s.ghostReplay !== null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const store = useGameStore.getState();
    const replay = useReplayStore.getState();

    // Only show ghost during a run
    if (store.runState !== RUN_STATES.RUNNING || !replay.ghostReplay) {
      mesh.visible = false;
      return;
    }

    const elapsedMs = performance.now() - store.startTime;
    const ghostData = replay.getGhostPosition(elapsedMs);

    if (!ghostData) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    mesh.position.set(ghostData.position[0], ghostData.position[1], ghostData.position[2]);
    mesh.rotation.copy(new Euler(0, ghostData.yaw, 0, 'YXZ'));
  });

  if (!hasGhost) return null;

  return (
    <mesh ref={meshRef} visible={false}>
      <capsuleGeometry args={[PHYSICS.PLAYER_RADIUS, PHYSICS.PLAYER_HEIGHT - PHYSICS.PLAYER_RADIUS * 2, 4, 8]} />
      <meshStandardMaterial
        color={GHOST_COLOR}
        emissive={GHOST_COLOR}
        emissiveIntensity={0.5}
        transparent
        opacity={GHOST_OPACITY}
        depthWrite={false}
      />
    </mesh>
  );
}
