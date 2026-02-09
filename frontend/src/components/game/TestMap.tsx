import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
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
import { AtmosphericFog } from './AtmosphericFog';
import { ProceduralSkybox } from './ProceduralSkybox';
import { GpuLightSprites } from '../../engine/effects/GpuLightSprites';
import { useShadowLight } from '../../engine/rendering';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useCombatStore } from '../../stores/combatStore';
import { devLog } from '../../engine/stores/devLogStore';

const TOTAL_CHECKPOINTS = 3;
const SPAWN_POINT: [number, number, number] = [0, 2, 0];
const SPAWN_YAW = 0;

const GRID = {
  SIZE: 200,
  DIVISIONS: 40,
  LINE_MAIN: '#555555',
  LINE_SUB: '#333333',
} as const;

const PILLAR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#2980b9',
] as const;

const SECTOR_MARKERS: Array<{
  position: [number, number, number];
  color: string;
  label: string;
}> = [
  { position: [0, 0, 0], color: '#ffffff', label: 'Origin' },
  { position: [40, 0, 0], color: '#e74c3c', label: '+X' },
  { position: [-40, 0, 0], color: '#c0392b', label: '-X' },
  { position: [0, 0, -40], color: '#3498db', label: '-Z' },
  { position: [0, 0, 40], color: '#2980b9', label: '+Z' },
];

const BACKGROUND_COLOR = '#1a1a2e';

export function TestMap() {
  const scene = useThree((s) => s.scene);
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);

  useShadowLight({
    quality: shadowQuality,
    position: [60, 100, 40],
    intensity: 1.4,
  });

  useEffect(() => {
    devLog.info('Map', 'Loading GridMap...');
    scene.background = new Color(BACKGROUND_COLOR);
    useGameStore.getState().initRun({
      checkpointCount: TOTAL_CHECKPOINTS,
      spawnPoint: SPAWN_POINT,
      spawnYaw: SPAWN_YAW,
    });
    useCombatStore.getState().resetCombat(5, 3);
    devLog.success('Map', `GridMap loaded (${TOTAL_CHECKPOINTS} checkpoints)`);
  }, [scene]);

  return (
    <group>
      {/* ── Ground plane ── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[100, 0.5, 100]} position={[0, -0.5, 0]} />
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <boxGeometry args={[200, 1, 200]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      </RigidBody>

      {/* ── Grid overlay ── */}
      <gridHelper
        args={[GRID.SIZE, GRID.DIVISIONS, GRID.LINE_MAIN, GRID.LINE_SUB]}
        position={[0, 0.02, 0]}
      />

      {/* ── Axis lines on ground (colored strips) ── */}
      <mesh position={[50, 0.03, 0]} receiveShadow>
        <boxGeometry args={[100, 0.02, 0.3]} />
        <meshStandardMaterial color="#e74c3c" emissive="#e74c3c" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-50, 0.03, 0]} receiveShadow>
        <boxGeometry args={[100, 0.02, 0.3]} />
        <meshStandardMaterial color="#922b21" emissive="#922b21" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 50]} receiveShadow>
        <boxGeometry args={[0.3, 0.02, 100]} />
        <meshStandardMaterial color="#3498db" emissive="#3498db" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.03, -50]} receiveShadow>
        <boxGeometry args={[0.3, 0.02, 100]} />
        <meshStandardMaterial color="#1a5276" emissive="#1a5276" emissiveIntensity={0.3} />
      </mesh>

      {/* ── Sector marker pillars ── */}
      {SECTOR_MARKERS.map((marker) => (
        <group key={marker.label}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider
              args={[0.5, 5, 0.5]}
              position={[marker.position[0], 5, marker.position[2]]}
            />
            <mesh position={[marker.position[0], 5, marker.position[2]]} castShadow receiveShadow>
              <boxGeometry args={[1, 10, 1]} />
              <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.3} />
            </mesh>
          </RigidBody>
          <mesh position={[marker.position[0], 10.3, marker.position[2]]}>
            <boxGeometry args={[1.6, 0.3, 1.6]} />
            <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[marker.position[0], 0.04, marker.position[2]]}>
            <boxGeometry args={[3, 0.02, 3]} />
            <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}

      {/* ── Beacon pillars in a ring (radius 30u) ── */}
      {PILLAR_COLORS.map((color, i) => {
        const angle = (i / PILLAR_COLORS.length) * Math.PI * 2;
        const radius = 30;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <group key={`pillar-${i}`}>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.6, 6, 0.6]} position={[x, 6, z]} />
              <mesh position={[x, 6, z]} castShadow receiveShadow>
                <boxGeometry args={[1.2, 12, 1.2]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
              </mesh>
            </RigidBody>
            <mesh position={[x, 12.5, z]}>
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} />
            </mesh>
            <mesh position={[x, 0.04, z]}>
              <boxGeometry args={[2.5, 0.02, 2.5]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
          </group>
        );
      })}

      {/* ── Distance marker walls ── */}
      {[20, 40, 60, 80].map((dist) => (
        <RigidBody key={`dist-${dist}`} type="fixed" colliders={false}>
          <CuboidCollider args={[0.15, 1, 3]} position={[dist, 1, 0]} />
          <mesh position={[dist, 1, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.3, 2, 6]} />
            <meshStandardMaterial
              color="#e74c3c"
              emissive="#e74c3c"
              emissiveIntensity={0.2 + dist * 0.005}
              transparent
              opacity={0.8}
            />
          </mesh>
        </RigidBody>
      ))}

      {/* ── Elevated platforms ── */}
      {[0, 1, 2, 3, 4].map((step) => (
        <Platform
          key={`step-${step}`}
          position={[-15 - step * 4, (step + 1) * 1.5, -15]}
          size={[3.5, 0.4, 3.5]}
          color={`hsl(${200 + step * 25}, 60%, ${40 + step * 5}%)`}
        />
      ))}

      {/* ── Ramp ── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3, 0.15, 10]} position={[20, 2.5, -20]} rotation={[-0.2, 0, 0]} />
        <mesh position={[20, 2.5, -20]} rotation={[-0.2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 0.3, 20]} />
          <meshStandardMaterial color="#5a7a4a" emissive="#5a7a4a" emissiveIntensity={0.15} />
        </mesh>
      </RigidBody>

      {/* ── Walls ── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 3, 8]} position={[-8, 3, 20]} />
        <mesh position={[-8, 3, 20]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 6, 16]} />
          <meshStandardMaterial color="#4a4a6a" emissive="#4a4a6a" emissiveIntensity={0.1} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[8, 3, 0.25]} position={[0, 3, 28]} />
        <mesh position={[0, 3, 28]} castShadow receiveShadow>
          <boxGeometry args={[16, 6, 0.5]} />
          <meshStandardMaterial color="#4a6a4a" emissive="#4a6a4a" emissiveIntensity={0.1} />
        </mesh>
      </RigidBody>

      {/* ── Corridor ── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 2.5, 20]} position={[48, 2.5, 0]} />
        <mesh position={[48, 2.5, 0]} castShadow>
          <boxGeometry args={[0.5, 5, 40]} />
          <meshStandardMaterial color="#3d3d5c" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 2.5, 20]} position={[53, 2.5, 0]} />
        <mesh position={[53, 2.5, 0]} castShadow>
          <boxGeometry args={[0.5, 5, 40]} />
          <meshStandardMaterial color="#3d3d5c" />
        </mesh>
      </RigidBody>

      {/* ── Welcome arch ── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 5, 0.5]} position={[-4, 5, -6]} />
        <mesh position={[-4, 5, -6]} castShadow receiveShadow>
          <boxGeometry args={[1, 10, 1]} />
          <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.4} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 5, 0.5]} position={[4, 5, -6]} />
        <mesh position={[4, 5, -6]} castShadow receiveShadow>
          <boxGeometry args={[1, 10, 1]} />
          <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.4} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 10.5, -6]}>
        <boxGeometry args={[9, 1, 1]} />
        <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.04, -6]}>
        <boxGeometry args={[8, 0.02, 2]} />
        <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.8} />
      </mesh>

      {/* ── Gameplay Zones ── */}
      <StartZone position={[0, 2, -3]} size={[6, 4, 4]} />
      <Checkpoint position={[20, 2, -20]} size={[6, 4, 4]} index={0} />
      <Checkpoint position={[50, 2, 0]} size={[6, 4, 4]} index={1} />
      <Checkpoint position={[-15, 8, -15]} size={[6, 4, 4]} index={2} />
      <FinishZone position={[0, 2, 28]} size={[6, 4, 4]} />
      <KillZone position={[0, -55, 0]} size={[300, 10, 300]} />

      {/* ── Movement items ── */}
      <BoostPad position={[50.5, 0.1, -15]} direction={[0, 0, 1]} speed={500} />
      <LaunchPad position={[10, 0.15, 15]} direction={[0, 0.6, -0.8]} speed={600} />
      <SpeedGate position={[20, 3, -10]} />
      <AmmoPickup position={[5, 0.5, -8]} type="rocket" amount={3} />
      <AmmoPickup position={[30, 0.5, 5]} type="grenade" amount={2} />
      <GrapplePoint position={[-15, 14, -15]} />
      <GrapplePoint position={[40, 12, -10]} />

      {/* ── Lighting ── */}
      <ambientLight intensity={0.5} />
      {/* DirectionalLight + CSM managed by useShadowLight hook */}
      <hemisphereLight args={['#87ceeb', '#3a3a3a', 0.4]} />

      {/* ── Light sprites (1 draw call) ── */}
      <GpuLightSprites lights={[
        { position: [50.5, 1, -15], color: '#00ff88', size: 3.0 },
        { position: [10, 1, 15], color: '#ff6600', size: 3.0 },
        { position: [20, 4, -10], color: '#00ccff', size: 2.0 },
        { position: [5, 1.5, -8], color: '#ef4444', size: 2.0 },
        { position: [30, 1.5, 5], color: '#22c55e', size: 2.0 },
        { position: [-15, 15, -15], color: '#a78bfa', size: 3.0 },
        { position: [40, 13, -10], color: '#a78bfa', size: 3.0 },
      ]} />

      {/* ── Environment ── */}
      <ProceduralSkybox type="night" />
      <AtmosphericFog color={BACKGROUND_COLOR} near={100} far={300} />
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
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
    </RigidBody>
  );
}
