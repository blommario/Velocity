import { useEffect, useRef } from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { StartZone } from '../zones/StartZone';
import { Checkpoint } from '../zones/Checkpoint';
import { FinishZone } from '../zones/FinishZone';
import { KillZone } from '../zones/KillZone';
import { BoostPad } from '../zones/BoostPad';
import { LaunchPad } from '../zones/LaunchPad';
import { SpeedGate } from '../zones/SpeedGate';
import { AmmoPickup } from '../zones/AmmoPickup';
import { GrapplePoint } from '../zones/GrapplePoint';
import { AtmosphericFog } from '../AtmosphericFog';
import { InstancedBlocks } from './InstancedBlocks';
import { useGameStore } from '../../../stores/gameStore';
import { useCombatStore } from '../../../stores/combatStore';
import type { MapData, MapBlock, MovingPlatformData, Vec3 } from './types';

const DEFAULT_LIGHTING = {
  ambientIntensity: 0.4,
  directionalIntensity: 1.2,
  directionalPosition: [50, 80, 30] as Vec3,
  hemisphereGround: '#3a3a3a',
  hemisphereSky: '#87ceeb',
  hemisphereIntensity: 0.3,
  fogColor: '#1a1a2e',
  fogNear: 80,
  fogFar: 200,
};

interface MapLoaderProps {
  data: MapData;
  mapId?: string;
}

export function MapLoader({ data, mapId }: MapLoaderProps) {
  const spawnYaw = Math.atan2(data.spawnDirection[0], data.spawnDirection[2]);

  useEffect(() => {
    useGameStore.getState().initRun(
      data.checkpoints.length,
      data.spawnPoint,
      spawnYaw,
      mapId,
    );
    useCombatStore.getState().resetCombat(
      data.settings?.maxRocketAmmo ?? 5,
      data.settings?.maxGrenadeAmmo ?? 3,
    );
  }, [data, mapId, spawnYaw]);

  const lighting = { ...DEFAULT_LIGHTING, ...data.lighting };
  const bgColor = data.backgroundColor ?? '#1a1a2e';

  return (
    <group>
      {/* Blocks (static geometry — instanced for performance) */}
      <InstancedBlocks blocks={data.blocks} />

      {/* Start zone at spawn */}
      <StartZone
        position={data.spawnPoint}
        size={[4, 4, 4]}
      />

      {/* Checkpoints */}
      {data.checkpoints.map((cp) => (
        <Checkpoint
          key={`cp-${cp.index}`}
          position={cp.position}
          size={cp.size}
          index={cp.index}
        />
      ))}

      {/* Finish */}
      <FinishZone position={data.finish.position} size={data.finish.size} />

      {/* Kill zones */}
      {data.killZones?.map((kz, i) => (
        <KillZone key={`kz-${i}`} position={kz.position} size={kz.size} />
      ))}

      {/* Boost pads */}
      {data.boostPads?.map((bp, i) => (
        <BoostPad
          key={`bp-${i}`}
          position={bp.position}
          direction={bp.direction}
          speed={bp.speed}
          size={bp.size}
          color={bp.color}
        />
      ))}

      {/* Launch pads */}
      {data.launchPads?.map((lp, i) => (
        <LaunchPad
          key={`lp-${i}`}
          position={lp.position}
          direction={lp.direction}
          speed={lp.speed}
          size={lp.size}
          color={lp.color}
        />
      ))}

      {/* Speed gates */}
      {data.speedGates?.map((sg, i) => (
        <SpeedGate
          key={`sg-${i}`}
          position={sg.position}
          size={sg.size}
          multiplier={sg.multiplier}
          minSpeed={sg.minSpeed}
          color={sg.color}
        />
      ))}

      {/* Ammo pickups */}
      {data.ammoPickups?.map((ap, i) => (
        <AmmoPickup
          key={`ap-${i}`}
          position={ap.position}
          type={ap.weaponType}
          amount={ap.amount}
          respawnTime={ap.respawnTime}
        />
      ))}

      {/* Grapple points */}
      {data.grapplePoints?.map((gp, i) => (
        <GrapplePoint key={`gp-${i}`} position={gp.position} />
      ))}

      {/* Surf ramps */}
      {data.surfRamps?.map((sr, i) => (
        <BlockRenderer
          key={`surf-${i}`}
          block={{
            shape: 'ramp',
            position: sr.position,
            size: sr.size,
            rotation: sr.rotation,
            color: sr.color ?? '#6688aa',
          }}
        />
      ))}

      {/* Moving platforms */}
      {data.movingPlatforms?.map((mp, i) => (
        <MovingPlatformRenderer key={`mp-${i}`} platform={mp} />
      ))}

      {/* Lighting */}
      <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
      <directionalLight
        position={lighting.directionalPosition}
        intensity={lighting.directionalIntensity}
        color={lighting.directionalColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <hemisphereLight
        args={[lighting.hemisphereSky, lighting.hemisphereGround, lighting.hemisphereIntensity]}
      />

      {/* Environment */}
      <color attach="background" args={[bgColor]} />
      <AtmosphericFog color={lighting.fogColor!} near={lighting.fogNear!} far={lighting.fogFar!} />

      {/* Grid for orientation */}
      <gridHelper args={[400, 80, '#333', '#222']} position={[0, 0.01, 0]} />
    </group>
  );
}

// ── Block Renderer ──

function BlockRenderer({ block }: { block: MapBlock }) {
  const rot = block.rotation ?? [0, 0, 0];
  const halfSize: Vec3 = [block.size[0] / 2, block.size[1] / 2, block.size[2] / 2];

  return (
    <RigidBody type="fixed" colliders={false}>
      {block.shape === 'cylinder' ? (
        <CylinderCollider
          args={[halfSize[1], halfSize[0]]}
          position={block.position}
          rotation={rot}
        />
      ) : (
        <CuboidCollider
          args={halfSize}
          position={block.position}
          rotation={rot}
        />
      )}
      <mesh position={block.position} rotation={rot} castShadow receiveShadow>
        {block.shape === 'cylinder' ? (
          <cylinderGeometry args={[halfSize[0], halfSize[0], block.size[1], 16]} />
        ) : (
          <boxGeometry args={block.size} />
        )}
        <meshStandardMaterial
          color={block.color}
          emissive={block.emissive ?? '#000000'}
          emissiveIntensity={block.emissiveIntensity ?? 0}
          transparent={block.transparent ?? false}
          opacity={block.opacity ?? 1}
        />
      </mesh>
    </RigidBody>
  );
}

// ── Moving Platform ──

function MovingPlatformRenderer({ platform }: { platform: MovingPlatformData }) {
  const rbRef = useRef<import('@react-three/rapier').RapierRigidBody>(null);
  const timeRef = useRef(0);
  const color = platform.color ?? '#8888aa';

  useFrame((_, delta) => {
    const rb = rbRef.current;
    if (!rb || platform.waypoints.length < 2) return;

    timeRef.current += delta;

    // Calculate total path length for timing
    const waypoints = platform.waypoints;
    const segments: number[] = [];
    let totalLength = 0;
    for (let i = 0; i < waypoints.length; i++) {
      const next = waypoints[(i + 1) % waypoints.length];
      const curr = waypoints[i];
      const len = Math.sqrt(
        (next[0] - curr[0]) ** 2 +
        (next[1] - curr[1]) ** 2 +
        (next[2] - curr[2]) ** 2,
      );
      segments.push(len);
      totalLength += len;
    }

    const pauseTotal = (platform.pauseTime ?? 0) * waypoints.length;
    const moveTime = totalLength / platform.speed;
    const cycleTime = moveTime + pauseTotal;
    const t = timeRef.current % cycleTime;

    // Find which segment we're on
    let elapsed = 0;
    for (let i = 0; i < waypoints.length; i++) {
      const segmentMoveTime = segments[i] / platform.speed;
      const segmentPause = platform.pauseTime ?? 0;
      const segmentTotal = segmentMoveTime + segmentPause;

      if (t < elapsed + segmentTotal) {
        const localT = t - elapsed;
        if (localT < segmentPause) {
          // Pausing at waypoint i
          rb.setNextKinematicTranslation({
            x: waypoints[i][0], y: waypoints[i][1], z: waypoints[i][2],
          });
        } else {
          // Moving from i to next
          const moveFrac = (localT - segmentPause) / segmentMoveTime;
          const next = waypoints[(i + 1) % waypoints.length];
          const pos = new Vector3().lerpVectors(
            new Vector3(...waypoints[i]),
            new Vector3(...next),
            Math.min(moveFrac, 1),
          );
          rb.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
        }
        break;
      }
      elapsed += segmentTotal;
    }
  });

  const halfSize: Vec3 = [platform.size[0] / 2, platform.size[1] / 2, platform.size[2] / 2];

  return (
    <RigidBody ref={rbRef} type="kinematicPosition" colliders={false} position={platform.waypoints[0]}>
      <CuboidCollider args={halfSize} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={platform.size} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
}
