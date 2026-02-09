import { useEffect, useMemo, useRef } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
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
import { ProceduralSkybox } from '../ProceduralSkybox';
import { HdriSkybox } from '../HdriSkybox';
import { GpuLightSprites, type LightSpriteData } from '../../../engine/effects/GpuLightSprites';
import { useClusteredLighting, useTileClusteredLighting, useShadowLight, type LightData } from '../../../engine/rendering';
import { InstancedBlocks } from './InstancedBlocks';
import { InstancedSurfRamps } from './InstancedSurfRamps';
import { ModelBlock } from './ModelBlock';
import { WaterSurface } from '../environment/WaterSurface';
import { FogVolume } from '../environment/FogVolume';
import { ParticleEmitter } from '../environment/ParticleEmitter';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useCombatStore } from '../../../stores/combatStore';
import { devLog } from '../../../engine/stores/devLogStore';
import { resetPool } from '../physics/projectilePool';
import { clearAssetCache } from '../../../services/assetManager';
import type { MapData, MovingPlatformData, Vec3 } from './types';

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
  // Three.js camera at yaw=0 looks in -Z. To convert spawnDirection to yaw:
  // forward = (-sin(yaw), 0, -cos(yaw)), so yaw = atan2(-dir.x, -dir.z)
  const spawnYaw = Math.atan2(-data.spawnDirection[0], -data.spawnDirection[2]);

  useEffect(() => {
    devLog.info('Map', `Loading map "${mapId ?? 'unknown'}" (${data.blocks.length} blocks, ${data.checkpoints.length} checkpoints)`);
    useGameStore.getState().initRun({
      checkpointCount: data.checkpoints.length,
      spawnPoint: data.spawnPoint,
      spawnYaw,
      mapId,
    });
    resetPool();
    useCombatStore.getState().resetCombat(
      data.settings?.maxRocketAmmo ?? 10,
      data.settings?.maxGrenadeAmmo ?? 3,
    );
    devLog.success('Map', `Map loaded — spawn at [${data.spawnPoint.map(v => v.toFixed(0)).join(', ')}]`);

    return () => {
      clearAssetCache();
      devLog.info('Map', 'Asset cache cleared on map change');
    };
  }, [data, mapId, spawnYaw]);

  const lighting = { ...DEFAULT_LIGHTING, ...data.lighting };
  const bgColor = data.backgroundColor ?? '#1a1a2e';

  // Collect all light sprite positions into a single array for GpuLightSprites (1 draw call)
  const lightSprites = useMemo(() => {
    const sprites: LightSpriteData[] = [];
    for (const bp of data.boostPads ?? []) {
      sprites.push({
        position: [bp.position[0], bp.position[1] + 1, bp.position[2]],
        color: bp.color ?? '#00ff88',
        size: 3.0,
      });
    }
    for (const sg of data.speedGates ?? []) {
      sprites.push({
        position: sg.position,
        color: sg.color ?? '#00ccff',
        size: 2.0,
      });
    }
    for (const gp of data.grapplePoints ?? []) {
      sprites.push({
        position: [gp.position[0], gp.position[1] + 1, gp.position[2]],
        color: '#a78bfa',
        size: 3.0,
      });
    }
    return sprites;
  }, [data.boostPads, data.speedGates, data.grapplePoints]);

  // Convert sprite data → LightData for clustered PBR lighting
  const clusterLightData = useMemo((): LightData[] => {
    return lightSprites.map((s) => ({
      position: s.position,
      color: s.color,
      intensity: 2.0,
      distance: 30,
      decay: 2,
    }));
  }, [lightSprites]);

  // Steg 1: PointLight pool (used when < 64 lights)
  const { lightsNode } = useClusteredLighting({ lights: clusterLightData });

  // Steg 2: Tile-clustered GPU compute (used when >= 64 lights)
  const { tileLightingNode, isTileClustered } = useTileClusteredLighting({ lights: clusterLightData });

  // Shadow light — quality driven by settings store
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);
  useShadowLight({
    quality: shadowQuality,
    position: lighting.directionalPosition,
    intensity: lighting.directionalIntensity,
    color: lighting.directionalColor,
  });

  // Only bind lightsNode when the map actually has point lights
  const hasLights = clusterLightData.length > 0;

  return (
    <group>
      {/* Blocks (static geometry — instanced for performance) */}
      <InstancedBlocks
        blocks={data.blocks}
        lightsNode={hasLights && !isTileClustered ? lightsNode : undefined}
        tileLightingNode={hasLights && isTileClustered && tileLightingNode ? tileLightingNode : undefined}
      />

      {/* glTF models */}
      {data.models?.map((model, i) => (
        <ModelBlock key={`model-${i}`} model={model} />
      ))}

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

      {/* Surf ramps (instanced) */}
      {data.surfRamps && data.surfRamps.length > 0 && (
        <InstancedSurfRamps ramps={data.surfRamps} />
      )}

      {/* Moving platforms */}
      {data.movingPlatforms?.map((mp, i) => (
        <MovingPlatformRenderer key={`mp-${i}`} platform={mp} />
      ))}

      {/* Water/lava surfaces */}
      {data.waterSurfaces?.map((ws, i) => (
        <WaterSurface key={`ws-${i}`} data={ws} />
      ))}

      {/* Volumetric fog volumes */}
      {data.fogVolumes?.map((fv, i) => (
        <FogVolume key={`fv-${i}`} data={fv} />
      ))}

      {/* Particle emitters (smoke, fire, ash, etc.) */}
      {data.particleEmitters?.map((pe, i) => (
        <ParticleEmitter key={`pe-${i}`} data={pe} />
      ))}

      {/* Lighting */}
      <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
      {/* DirectionalLight + CSM managed by useShadowLight hook */}
      <hemisphereLight
        args={[lighting.hemisphereSky, lighting.hemisphereGround, lighting.hemisphereIntensity]}
      />

      {/* Light sprites — single instanced draw call replaces N PointLights */}
      {lightSprites.length > 0 && <GpuLightSprites lights={lightSprites} />}

      {/* Environment — HDRI or procedural skybox */}
      {data.skybox?.startsWith('hdri:') ? (
        <HdriSkybox filename={data.skybox.slice(5)} />
      ) : (
        <>
          <ProceduralSkybox type={data.skybox ?? 'day'} />
          <color attach="background" args={[bgColor]} />
        </>
      )}
      <AtmosphericFog color={lighting.fogColor!} near={lighting.fogNear!} far={lighting.fogFar!} />

      {/* Grid for orientation */}
      <gridHelper args={[400, 80, '#333', '#222']} position={[0, 0.01, 0]} />
    </group>
  );
}

// ── Moving Platform ──

function MovingPlatformRenderer({ platform }: { platform: MovingPlatformData }) {
  const rbRef = useRef<import('@react-three/rapier').RapierRigidBody>(null);
  const timeRef = useRef(0);
  // Per-instance scratch vectors — avoids shared-singleton bugs with multiple platforms
  const vecRef = useRef({ from: new Vector3(), to: new Vector3(), pos: new Vector3() });
  const color = platform.color ?? '#8888aa';

  // Pre-compute segment lengths once (stable reference — waypoints don't change)
  const { segments, totalLength } = useMemo(() => {
    const segs: number[] = [];
    let total = 0;
    const wps = platform.waypoints;
    for (let i = 0; i < wps.length; i++) {
      const next = wps[(i + 1) % wps.length];
      const curr = wps[i];
      const len = Math.sqrt(
        (next[0] - curr[0]) ** 2 +
        (next[1] - curr[1]) ** 2 +
        (next[2] - curr[2]) ** 2,
      );
      segs.push(len);
      total += len;
    }
    return { segments: segs, totalLength: total };
  }, [platform.waypoints]);

  useFrame((_, delta) => {
    const rb = rbRef.current;
    if (!rb || platform.waypoints.length < 2) return;

    timeRef.current += delta;

    const waypoints = platform.waypoints;
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
          rb.setNextKinematicTranslation({
            x: waypoints[i][0], y: waypoints[i][1], z: waypoints[i][2],
          });
        } else {
          const moveFrac = Math.min((localT - segmentPause) / segmentMoveTime, 1);
          const next = waypoints[(i + 1) % waypoints.length];
          const { from, to, pos } = vecRef.current;
          from.set(waypoints[i][0], waypoints[i][1], waypoints[i][2]);
          to.set(next[0], next[1], next[2]);
          pos.lerpVectors(from, to, moveFrac);
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
