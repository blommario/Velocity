import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  Fn, float, vec3, vec4, uniform, positionLocal,
  dot, pow, mix, smoothstep, abs,
  sin, cos, normalize,
} from 'three/tsl';
import {
  Mesh as ThreeMesh, SphereGeometry, NodeMaterial,
  BackSide,
} from 'three/webgpu';

export interface SkyPreset {
  sunColor: [number, number, number];
  zenithColor: [number, number, number];
  horizonColor: [number, number, number];
  sunPos: [number, number, number];
  sunSize: number;
  sunIntensity: number;
}

export const SKY_PRESETS = {
  day: {
    sunColor: [1.0, 0.95, 0.8],
    zenithColor: [0.18, 0.32, 0.65],
    horizonColor: [0.55, 0.65, 0.85],
    sunPos: [0.4, 0.8, 0.3],
    sunSize: 0.02,
    sunIntensity: 3.0,
  },
  sunset: {
    sunColor: [1.0, 0.5, 0.15],
    zenithColor: [0.12, 0.1, 0.35],
    horizonColor: [0.85, 0.35, 0.15],
    sunPos: [0.6, 0.15, 0.2],
    sunSize: 0.04,
    sunIntensity: 4.0,
  },
  night: {
    sunColor: [0.6, 0.7, 1.0],
    zenithColor: [0.02, 0.02, 0.08],
    horizonColor: [0.06, 0.06, 0.15],
    sunPos: [0.3, 0.5, -0.4],
    sunSize: 0.01,
    sunIntensity: 1.5,
  },
  neon: {
    sunColor: [0.4, 0.0, 1.0],
    zenithColor: [0.03, 0.01, 0.1],
    horizonColor: [0.15, 0.0, 0.3],
    sunPos: [0.0, 0.6, 0.5],
    sunSize: 0.03,
    sunIntensity: 5.0,
  },
  sky: {
    sunColor: [1.0, 0.9, 0.7],
    zenithColor: [0.15, 0.3, 0.6],
    horizonColor: [0.5, 0.6, 0.8],
    sunPos: [0.5, 0.7, 0.4],
    sunSize: 0.025,
    sunIntensity: 2.5,
  },
} as const satisfies Record<string, SkyPreset>;

export type ProceduralSkyPresetName = keyof typeof SKY_PRESETS;

interface ProceduralSkyboxProps {
  /** A preset name or custom SkyPreset config */
  preset?: ProceduralSkyPresetName | SkyPreset;
  radius?: number;
}

export function ProceduralSkybox({ preset = 'day', radius = 500 }: ProceduralSkyboxProps) {
  const { scene, camera } = useThree();
  const meshRef = useRef<ThreeMesh | null>(null);
  const timeRef = useRef(0);
  const timeUniform = useRef(uniform(float(0)));

  useEffect(() => {
    const config = typeof preset === 'string' ? SKY_PRESETS[preset] : preset;

    // Pre-normalize sun direction on CPU
    const sx = config.sunPos[0], sy = config.sunPos[1], sz = config.sunPos[2];
    const len = Math.sqrt(sx * sx + sy * sy + sz * sz);

    const sunDirection = uniform(vec3(sx / len, sy / len, sz / len));
    const uSunColor = uniform(vec3(config.sunColor[0], config.sunColor[1], config.sunColor[2]));
    const uZenithColor = uniform(vec3(config.zenithColor[0], config.zenithColor[1], config.zenithColor[2]));
    const uHorizonColor = uniform(vec3(config.horizonColor[0], config.horizonColor[1], config.horizonColor[2]));
    const sunSize = uniform(float(config.sunSize));
    const sunIntensity = uniform(float(config.sunIntensity));
    const uTime = timeUniform.current;

    // Sky shader using positionLocal (sphere geometry provides direction vectors)
    const skyColor = Fn(() => {
      const dir = normalize(positionLocal);
      const upDot = dir.y;

      // Base gradient: horizon -> zenith
      const skyFactor = smoothstep(-0.05, 0.5, upDot);
      const baseColor = mix(uHorizonColor, uZenithColor, skyFactor);

      // Sun disc
      const sunDot = dot(dir, sunDirection).clamp(0, 1);
      const sunDisc = smoothstep(float(1).sub(sunSize), float(1), sunDot).mul(sunIntensity);
      const sunGlow = pow(sunDot, float(64)).mul(sunIntensity).mul(0.3);

      // Atmospheric scattering near horizon
      const horizonGlow = smoothstep(0.3, 0.0, abs(upDot)).mul(0.15);
      const scatterColor = mix(uHorizonColor, uSunColor, float(0.3));

      // Subtle cloud noise
      const cloudU = dir.x.mul(3).add(uTime.mul(0.02));
      const cloudV = dir.z.mul(3).add(uTime.mul(0.01));
      const cloudNoise = sin(cloudU.mul(2.3)).mul(cos(cloudV.mul(1.7))).add(
        sin(cloudU.mul(5.1).add(0.7)).mul(cos(cloudV.mul(3.9).add(1.2))).mul(0.5),
      ).mul(0.5).add(0.5);
      const cloudAlpha = smoothstep(0.55, 0.7, cloudNoise).mul(
        smoothstep(-0.1, 0.3, upDot),
      ).mul(0.15);

      const color = baseColor
        .add(uSunColor.mul(sunDisc))
        .add(uSunColor.mul(sunGlow))
        .add(scatterColor.mul(horizonGlow))
        .add(vec3(cloudAlpha, cloudAlpha, cloudAlpha));

      // Below horizon: fade to dark
      const belowHorizon = smoothstep(0.0, -0.15, upDot);
      return mix(color, vec3(0.02, 0.02, 0.05), belowHorizon);
    })();

    const geometry = new SphereGeometry(radius, 32, 16);
    const material = new NodeMaterial();
    material.side = BackSide;
    material.depthWrite = false;
    material.fog = false;
    material.lights = false;
    material.colorNode = skyColor;

    const mesh = new ThreeMesh(geometry, material);
    mesh.renderOrder = -1000;
    scene.add(mesh);
    meshRef.current = mesh;

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      meshRef.current = null;
    };
  }, [scene, preset, radius]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    timeUniform.current.value = timeRef.current;

    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }
  });

  return null;
}
