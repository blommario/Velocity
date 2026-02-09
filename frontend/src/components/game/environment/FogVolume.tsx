/**
 * FogVolume — Volumetric fog rendered as a transparent mesh with TSL density.
 *
 * Renders a semi-transparent box or sphere with depth-based density falloff.
 * Uses MeshStandardNodeMaterial with custom opacity/color nodes for
 * soft-edged volumetric appearance. No ray marching in post-processing —
 * uses mesh-based approach for simplicity and compatibility.
 *
 * Density varies based on:
 *  - Distance from volume edge (soft falloff)
 *  - Height within volume (heightFalloff)
 *  - Animated noise for natural movement
 *
 * Game-level component.
 */
import { useMemo } from 'react';
import {
  float, vec3, vec4, positionWorld, positionLocal,
  normalLocal, cameraPosition, time, sin, clamp, mix, uniform,
} from 'three/tsl';
import {
  MeshStandardNodeMaterial, AdditiveBlending, DoubleSide, BackSide,
} from 'three/webgpu';
import { BoxGeometry, SphereGeometry } from 'three';
import { fbm2D, valueNoise3D } from '../../../engine/rendering/tslNoise';
import type { FogVolumeData } from '../map/types';

const FOG_DEFAULTS = {
  color: '#8899aa',
  density: 0.5,
  heightFalloff: 0.0,
  sphereSegments: 24,
} as const;

interface FogVolumeProps {
  data: FogVolumeData;
}

export function FogVolume({ data }: FogVolumeProps) {
  const color = data.color ?? FOG_DEFAULTS.color;
  const density = data.density ?? FOG_DEFAULTS.density;
  const heightFalloff = data.heightFalloff ?? FOG_DEFAULTS.heightFalloff;

  const { geometry, material } = useMemo(() => {
    // Create geometry based on shape
    const geo = data.shape === 'sphere'
      ? new SphereGeometry(data.size[0], FOG_DEFAULTS.sphereSegments, FOG_DEFAULTS.sphereSegments)
      : new BoxGeometry(data.size[0] * 2, data.size[1] * 2, data.size[2] * 2);

    const mat = new MeshStandardNodeMaterial();

    // Parse color
    const cr = parseInt(color.slice(1, 3), 16) / 255;
    const cg = parseInt(color.slice(3, 5), 16) / 255;
    const cb = parseInt(color.slice(5, 7), 16) / 255;
    const fogColor = vec3(float(cr), float(cg), float(cb));

    // ── Density calculation ──
    // Use local position to compute distance from center (normalized 0..1)
    const localNorm = data.shape === 'sphere'
      ? positionLocal.length().div(float(data.size[0]))  // radius
      : vec3(
          positionLocal.x.div(float(data.size[0])),
          positionLocal.y.div(float(data.size[1])),
          positionLocal.z.div(float(data.size[2])),
        ).length().div(float(Math.SQRT2));

    // Soft edge falloff — density fades near edges
    const edgeFade = clamp(float(1.0).sub(localNorm), 0.0, 1.0);

    // Height-based falloff: denser at bottom, lighter at top
    const heightNorm = positionLocal.y.div(float(data.size[1])).add(0.5).clamp(0.0, 1.0);
    const heightDensity = heightFalloff > 0
      ? float(1.0).sub(heightNorm.mul(float(heightFalloff)))
      : float(1.0);

    // Animated noise for natural movement
    const noiseUV = vec3(
      positionWorld.x.mul(0.3).add(time.mul(0.05)),
      positionWorld.y.mul(0.3),
      positionWorld.z.mul(0.3).add(time.mul(0.08)),
    );
    const noiseFactor = valueNoise3D(noiseUV).mul(0.6).add(0.7);

    // Final opacity
    const baseDensity = float(density);
    const finalOpacity = baseDensity
      .mul(edgeFade)
      .mul(heightDensity.clamp(0.0, 1.0))
      .mul(noiseFactor)
      .clamp(0.0, 0.85);

    mat.colorNode = fogColor;
    mat.opacityNode = finalOpacity;
    mat.roughnessNode = float(1.0);
    mat.metalnessNode = float(0.0);
    mat.transparent = true;
    mat.side = DoubleSide;
    mat.depthWrite = false;

    return { geometry: geo, material: mat };
  }, [data.shape, data.size, color, density, heightFalloff]);

  return (
    <mesh
      position={data.position}
      geometry={geometry}
      material={material}
    />
  );
}
