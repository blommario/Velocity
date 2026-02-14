/**
 * Generic networked capsule — renders a semi-transparent capsule at an
 * interpolated network position. Reads directly from RemotePlayerInterpolators
 * in useFrame (60Hz) — no React re-renders needed for position updates.
 *
 * Depends on: R3F, Three.js, RemotePlayerInterpolators
 * Used by: game RemotePlayers (via prop injection)
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Euler } from 'three';
import { getInterpolator } from '../networking/RemotePlayerInterpolators';

const _euler = new Euler(0, 0, 0, 'YXZ');

export interface NetworkedCapsuleProps {
  /** Remote player ID — used to look up interpolator. */
  playerId: string;
  /** Capsule radius. */
  radius: number;
  /** Capsule total height. */
  height: number;
  /** Display color (CSS string). */
  color: string;
  /** Material opacity (0–1). */
  opacity?: number;
  /** Emissive intensity. */
  emissiveIntensity?: number;
}

export function NetworkedCapsule({
  playerId,
  radius,
  height,
  color,
  opacity = 0.7,
  emissiveIntensity = 0.8,
}: NetworkedCapsuleProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const interp = getInterpolator(playerId);
    if (!interp) {
      mesh.visible = false;
      return;
    }

    const sampled = interp.sample();
    if (!sampled) {
      mesh.visible = false;
      return;
    }

    mesh.position.set(sampled.position[0], sampled.position[1], sampled.position[2]);
    _euler.set(sampled.pitch, sampled.yaw, 0);
    mesh.rotation.copy(_euler);
    mesh.visible = true;
  });

  const bodyHeight = height - radius * 2;

  return (
    <mesh ref={meshRef} visible={false}>
      <capsuleGeometry args={[radius, bodyHeight, 4, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}
