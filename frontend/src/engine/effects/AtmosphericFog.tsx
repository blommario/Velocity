import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { fog, rangeFogFactor, color as tslColor, positionWorld, float } from 'three/tsl';
import { devLog } from '../stores/devLogStore';

const FOG_DEFAULTS = {
  HEIGHT_FADE_START: -10,
  HEIGHT_FADE_END: 60,
  HEIGHT_DENSITY_REDUCTION: 0.6,
} as const;

interface AtmosphericFogProps {
  color: string;
  near: number;
  far: number;
}

export function AtmosphericFog({ color, near, far }: AtmosphericFogProps) {
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const fogColor = tslColor(color);

    // Height-based fog: denser at ground, fading higher up
    const heightFactor = positionWorld.y
      .sub(FOG_DEFAULTS.HEIGHT_FADE_START)
      .div(FOG_DEFAULTS.HEIGHT_FADE_END - FOG_DEFAULTS.HEIGHT_FADE_START)
      .clamp(0, 1);

    // Reduce fog density at higher elevations
    const adjustedFar = float(far).add(heightFactor.mul(far * FOG_DEFAULTS.HEIGHT_DENSITY_REDUCTION));

    const fogFactor = rangeFogFactor(float(near), adjustedFar);
    scene.fogNode = fog(fogColor, fogFactor);
    devLog.success('Fog', `TSL height-fog active (near=${near}, far=${far})`);

    return () => {
      scene.fogNode = null;
    };
  }, [scene, color, near, far]);

  return null;
}
