/**
 * MapLoader — renders a complete map from MapData: instanced blocks, zones,
 * lighting, skybox, and environmental effects.
 *
 * Depends on: useMapInit, useMapLighting, MovingPlatformRenderer, InstancedBlocks, zone components
 * Used by: GameCanvas
 */
import { StartZone } from '../zones/StartZone';
import { Checkpoint } from '../zones/Checkpoint';
import { FinishZone } from '../zones/FinishZone';
import { KillZone } from '../zones/KillZone';
import { BoostPad } from '../zones/BoostPad';
import { LaunchPad } from '../zones/LaunchPad';
import { SpeedGate } from '../zones/SpeedGate';
import { AmmoPickup } from '../zones/AmmoPickup';
import { GrapplePoint } from '../zones/GrapplePoint';
import { AtmosphericFog } from '@engine/effects/AtmosphericFog';
import { ProceduralSkybox } from '@engine/effects/ProceduralSkybox';
import { HdriSkybox } from '@engine/effects/HdriSkybox';
import { GpuLightSprites } from '@engine/effects/GpuLightSprites';
import { InstancedBlocks, InstancedSurfRamps, ModelBlock, HeightmapTerrain } from '@engine/rendering';
import { WaterSurface } from '@engine/effects/WaterSurface';
import { FogVolume } from '@engine/effects/FogVolume';
import { ParticleEmitter } from '@engine/effects/ParticleEmitter';
import { useTexturedMaterial } from '@game/hooks/useTexturedMaterial';
import { loadHDRI, loadModel } from '@game/services/assetManager';
import { useMapInit } from './useMapInit';
import { useMapLighting } from './useMapLighting';
import { MovingPlatformRenderer } from './MovingPlatformRenderer';
import type { MapData } from './types';

interface MapLoaderProps {
  data: MapData;
  mapId?: string;
}

export function MapLoader({ data, mapId }: MapLoaderProps) {
  const spawnYaw = Math.atan2(-data.spawnDirection[0], -data.spawnDirection[2]);
  useMapInit(data, mapId, spawnYaw);

  const { lighting, lightSprites, lightsNode, tileLightingNode, isTileClustered, hasLights } =
    useMapLighting(data);

  const bgColor = data.backgroundColor ?? '#1a1a2e';

  return (
    <group>
      {/* Blocks (static geometry — instanced for performance) */}
      <InstancedBlocks
        blocks={data.blocks}
        lightsNode={hasLights && !isTileClustered ? lightsNode : undefined}
        tileLightingNode={hasLights && isTileClustered && tileLightingNode ? tileLightingNode : undefined}
        useTexturedMaterial={useTexturedMaterial as any}
      />

      {/* glTF models */}
      {data.models?.map((model, i) => (
        <ModelBlock key={`model-${i}`} model={model} loadModel={loadModel} />
      ))}

      {/* Start zone at spawn */}
      <StartZone position={data.spawnPoint} size={[4, 4, 4]} />

      {/* Checkpoints */}
      {data.checkpoints.map((cp) => (
        <Checkpoint key={`cp-${cp.index}`} position={cp.position} size={cp.size} index={cp.index} />
      ))}

      {/* Finish */}
      <FinishZone position={data.finish.position} size={data.finish.size} />

      {/* Kill zones */}
      {data.killZones?.map((kz, i) => (
        <KillZone key={`kz-${i}`} position={kz.position} size={kz.size} />
      ))}

      {/* Boost pads */}
      {data.boostPads?.map((bp, i) => (
        <BoostPad key={`bp-${i}`} position={bp.position} direction={bp.direction} speed={bp.speed} size={bp.size} color={bp.color} />
      ))}

      {/* Launch pads */}
      {data.launchPads?.map((lp, i) => (
        <LaunchPad key={`lp-${i}`} position={lp.position} direction={lp.direction} speed={lp.speed} size={lp.size} color={lp.color} />
      ))}

      {/* Speed gates */}
      {data.speedGates?.map((sg, i) => (
        <SpeedGate key={`sg-${i}`} position={sg.position} size={sg.size} multiplier={sg.multiplier} minSpeed={sg.minSpeed} color={sg.color} />
      ))}

      {/* Ammo pickups */}
      {data.ammoPickups?.map((ap, i) => (
        <AmmoPickup key={`ap-${i}`} position={ap.position} type={ap.weaponType} amount={ap.amount} respawnTime={ap.respawnTime} />
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

      {/* Heightmap terrains (smooth hills/valleys) */}
      {data.heightmapTerrains?.map((ht, i) => (
        <HeightmapTerrain key={`ht-${i}`} data={ht} />
      ))}

      {/* Lighting */}
      <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
      <hemisphereLight args={[lighting.hemisphereSky, lighting.hemisphereGround, lighting.hemisphereIntensity]} />

      {/* Light sprites — single instanced draw call replaces N PointLights */}
      {lightSprites.length > 0 && <GpuLightSprites lights={lightSprites} />}

      {/* Environment — HDRI or procedural skybox */}
      {data.skybox?.startsWith('hdri:') ? (
        <HdriSkybox loadHdri={loadHDRI} filename={data.skybox.slice(5)} />
      ) : (
        <>
          <ProceduralSkybox preset={(data.skybox ?? 'day') as any} />
          <color attach="background" args={[bgColor]} />
        </>
      )}
      <AtmosphericFog color={lighting.fogColor!} near={lighting.fogNear!} far={lighting.fogFar!} />

      {/* Grid for orientation */}
      <gridHelper args={[400, 80, '#333', '#222']} position={[0, 0.01, 0]} />
    </group>
  );
}
