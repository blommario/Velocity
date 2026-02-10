import { useMemo } from 'react';
import {
  float, vec2, vec3, sin, positionLocal,
  positionWorld, time, mix, clamp,
} from 'three/tsl';
import {
  MeshStandardNodeMaterial, DoubleSide,
} from 'three/webgpu';
import { PlaneGeometry } from 'three';
import { fbm2D } from '../rendering/tslNoise';
import type { WaterSurfaceData } from '../types/map';

const WATER_DEFAULTS = {
  color: '#1a6b8a',
  lavaColor: '#cc3300',
  flowSpeed: 1.0,
  waveHeight: 0.3,
  waveScale: 2.0,
  waterOpacity: 0.7,
  lavaOpacity: 0.9,
  segments: 64,
} as const;

interface WaterSurfaceProps {
  data: WaterSurfaceData;
}

export function WaterSurface({ data }: WaterSurfaceProps) {
  const isLava = data.type === 'lava';
  const baseColor = data.color ?? (isLava ? WATER_DEFAULTS.lavaColor : WATER_DEFAULTS.color);
  const flowSpeed = data.flowSpeed ?? WATER_DEFAULTS.flowSpeed;
  const waveHeight = data.waveHeight ?? WATER_DEFAULTS.waveHeight;
  const waveScale = data.waveScale ?? WATER_DEFAULTS.waveScale;
  const opacity = data.opacity ?? (isLava ? WATER_DEFAULTS.lavaOpacity : WATER_DEFAULTS.waterOpacity);
  const flowDir = data.flowDirection ?? [1, 0];

  const { geometry, material } = useMemo(() => {
    // PlaneGeometry lies in XY by default; mesh rotation (-90° X) makes it horizontal.
    // Vertex displacement is applied along local Z (becomes world Y after rotation).
    const geo = new PlaneGeometry(
      data.size[0], data.size[1],
      WATER_DEFAULTS.segments, WATER_DEFAULTS.segments,
    );

    const mat = new MeshStandardNodeMaterial();

    // Parse base color
    const cr = parseInt(baseColor.slice(1, 3), 16) / 255;
    const cg = parseInt(baseColor.slice(3, 5), 16) / 255;
    const cb = parseInt(baseColor.slice(5, 7), 16) / 255;

    // Flow offset for scrolling
    const flowX = float(flowDir[0]).mul(flowSpeed).mul(time);
    const flowZ = float(flowDir[1]).mul(flowSpeed).mul(time);
    const flowOffset = vec2(flowX, flowZ);

    // World-space UVs for noise sampling
    const worldUV = vec2(positionWorld.x, positionWorld.z).mul(float(1.0 / waveScale));
    const scrolledUV = worldUV.add(flowOffset.mul(0.1));

    // ── Vertex displacement (3 layered sine waves + noise) ──
    const waveH = float(waveHeight);
    const wx = positionWorld.x.mul(waveScale * 0.5);
    const wz = positionWorld.z.mul(waveScale * 0.7);

    const wave1 = sin(wx.add(time.mul(1.2))).mul(waveH.mul(0.5));
    const wave2 = sin(wz.add(time.mul(0.9)).add(1.5)).mul(waveH.mul(0.35));
    const wave3 = sin(wx.add(wz).mul(0.6).add(time.mul(1.6))).mul(waveH.mul(0.25));
    const noiseDisp = fbm2D(scrolledUV.mul(3.0)).sub(0.4).mul(waveH.mul(0.4));

    const totalDisp = wave1.add(wave2).add(wave3).add(noiseDisp);

    // Displace along local Z (PlaneGeometry normal), which is world Y after mesh rotation
    mat.positionNode = positionLocal.add(vec3(float(0), float(0), totalDisp));

    // ── Surface coloring — noise-based variation ──
    const noiseTint = fbm2D(scrolledUV).mul(0.3).add(0.85);
    const baseCol = vec3(float(cr), float(cg), float(cb));

    if (isLava) {
      // Lava: hot bright cracks via noise
      const crackNoise = fbm2D(scrolledUV.mul(4.0));
      const hotFactor = clamp(crackNoise.mul(2.0).sub(0.6), 0.0, 1.0);
      const hotColor = vec3(float(1.0), float(0.5), float(0.05));
      const lavaCol = mix(baseCol.mul(noiseTint), hotColor, hotFactor);

      mat.colorNode = lavaCol;
      mat.emissiveNode = lavaCol.mul(hotFactor.mul(3.0).add(0.5));
      mat.roughnessNode = float(0.85);
      mat.metalnessNode = float(0.0);
    } else {
      // Water: slight specular, low roughness
      mat.colorNode = baseCol.mul(noiseTint);
      mat.roughnessNode = float(0.15);
      mat.metalnessNode = float(0.1);
    }

    mat.transparent = true;
    mat.opacity = opacity;
    mat.side = DoubleSide;
    mat.depthWrite = false;

    return { geometry: geo, material: mat };
  }, [data.size, baseColor, flowDir, flowSpeed, waveHeight, waveScale, opacity, isLava]);

  return (
    <group position={data.position}>
      <mesh
        geometry={geometry}
        material={material}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />
    </group>
  );
}
