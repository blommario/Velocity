import { useEffect } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { StartZone } from './zones/StartZone';
import { Checkpoint } from './zones/Checkpoint';
import { FinishZone } from './zones/FinishZone';
import { KillZone } from './zones/KillZone';
import { useGameStore } from '../../stores/gameStore';

const TOTAL_CHECKPOINTS = 2;
const SPAWN_POINT: [number, number, number] = [0, 3, 0];
const SPAWN_YAW = 0;

export function TestMap() {
  useEffect(() => {
    useGameStore.getState().initRun(TOTAL_CHECKPOINTS, SPAWN_POINT, SPAWN_YAW);
  }, []);

  return (
    <group>
      {/* Large flat ground */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[100, 0.5, 100]} position={[0, -0.5, 0]} />
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <boxGeometry args={[200, 1, 200]} />
          <meshStandardMaterial color="#3a3a3a" />
        </mesh>
      </RigidBody>

      {/* Grid lines on floor for spatial reference */}
      <gridHelper args={[200, 40, '#555', '#444']} position={[0, 0.01, 0]} />

      {/* === Gameplay Zones === */}
      {/* Start zone — near spawn */}
      <StartZone position={[0, 2, -5]} size={[6, 4, 3]} />

      {/* Checkpoint 1 — after ramp section */}
      <Checkpoint position={[15, 2, -10]} size={[6, 4, 3]} index={0} />

      {/* Checkpoint 2 — after platforms */}
      <Checkpoint position={[30, 2, 0]} size={[6, 4, 3]} index={1} />

      {/* Finish zone — end of course */}
      <FinishZone position={[40, 2, -15]} size={[6, 4, 3]} />

      {/* Kill zone — below the map */}
      <KillZone position={[0, -55, 0]} size={[300, 10, 300]} />

      {/* === Map Geometry === */}
      {/* Ramp — gentle slope */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[3, 0.15, 8]}
          position={[15, 1.5, 0]}
          rotation={[-0.18, 0, 0]}
        />
        <mesh position={[15, 1.5, 0]} rotation={[-0.18, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 0.3, 16]} />
          <meshStandardMaterial color="#5a7a4a" />
        </mesh>
      </RigidBody>

      {/* Steep ramp */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[3, 0.15, 6]}
          position={[25, 2.5, 0]}
          rotation={[-0.4, 0, 0]}
        />
        <mesh position={[25, 2.5, 0]} rotation={[-0.4, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 0.3, 12]} />
          <meshStandardMaterial color="#7a5a4a" />
        </mesh>
      </RigidBody>

      {/* Wall for collision testing */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 4, 10]} position={[40, 4, 0]} />
        <mesh position={[40, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[1, 8, 20]} />
          <meshStandardMaterial color="#4a4a6a" />
        </mesh>
      </RigidBody>

      {/* Elevated platforms — various heights for jump testing */}
      <Platform position={[-10, 1, -10]} size={[4, 0.3, 4]} color="#6a4a5a" />
      <Platform position={[-10, 2.5, -18]} size={[4, 0.3, 4]} color="#5a6a4a" />
      <Platform position={[-10, 4, -26]} size={[4, 0.3, 4]} color="#4a5a6a" />
      <Platform position={[-10, 6, -34]} size={[3, 0.3, 3]} color="#6a5a4a" />

      {/* Corridor for strafe practice */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 3, 30]} position={[-25, 3, 0]} />
        <mesh position={[-25, 3, 0]} castShadow>
          <boxGeometry args={[0.5, 6, 60]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 3, 30]} position={[-20, 3, 0]} />
        <mesh position={[-20, 3, 0]} castShadow>
          <boxGeometry args={[0.5, 6, 60]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </RigidBody>

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 80, 30]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <hemisphereLight args={['#87ceeb', '#3a3a3a', 0.3]} />

      {/* Sky color */}
      <color attach="background" args={['#1a1a2e']} />
      <fog attach="fog" args={['#1a1a2e', 80, 200]} />
    </group>
  );
}

function Platform({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        position={position}
      />
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
}
