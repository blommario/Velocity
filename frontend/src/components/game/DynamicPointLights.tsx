import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointLight } from 'three';

const LIGHT_PULSE = {
  SPEED: 2.5,
  MIN_INTENSITY: 0.6,
  MAX_INTENSITY: 1.0,
} as const;

interface EmissivePointLightProps {
  position: [number, number, number];
  color: string;
  intensity?: number;
  distance?: number;
  pulse?: boolean;
}

export function EmissivePointLight({
  position,
  color,
  intensity = 2,
  distance = 15,
  pulse = true,
}: EmissivePointLightProps) {
  const lightRef = useRef<PointLight>(null);
  const timeRef = useRef(Math.random() * Math.PI * 2); // random phase offset

  useFrame((_, delta) => {
    if (!lightRef.current || !pulse) return;
    timeRef.current += delta * LIGHT_PULSE.SPEED;
    const t = (Math.sin(timeRef.current) + 1) * 0.5;
    const pulseFactor = LIGHT_PULSE.MIN_INTENSITY + t * (LIGHT_PULSE.MAX_INTENSITY - LIGHT_PULSE.MIN_INTENSITY);
    lightRef.current.intensity = intensity * pulseFactor;
  });

  return (
    <pointLight
      ref={lightRef}
      position={position}
      color={color}
      intensity={intensity}
      distance={distance}
      decay={2}
    />
  );
}
