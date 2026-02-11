/**
 * Generic networked capsule — renders a semi-transparent capsule at an
 * interpolated network position. Game layer injects snapshot data via props.
 *
 * Depends on: R3F, Three.js, NetworkInterpolator
 * Used by: game RemotePlayers (via prop injection)
 */
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Euler } from 'three';
import { NetworkInterpolator, type NetSnapshot } from '../networking/NetworkInterpolator';

const _euler = new Euler(0, 0, 0, 'YXZ');

export interface NetworkedCapsuleProps {
  /** Current snapshot from network — push new refs to trigger interpolation. */
  snapshot: NetSnapshot | null;
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
  /** Network tick interval in ms (default 50 = 20Hz). */
  intervalMs?: number;
}

export function NetworkedCapsule({
  snapshot,
  radius,
  height,
  color,
  opacity = 0.7,
  emissiveIntensity = 0.8,
  intervalMs = 50,
}: NetworkedCapsuleProps) {
  const meshRef = useRef<Mesh>(null);
  const interpRef = useRef(new NetworkInterpolator(intervalMs));

  // Push new snapshots into the interpolator
  useEffect(() => {
    if (snapshot) interpRef.current.push(snapshot);
  }, [snapshot]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const sampled = interpRef.current.sample();
    if (!sampled) {
      mesh.visible = false;
      return;
    }

    mesh.position.set(sampled.position[0], sampled.position[1], sampled.position[2]);
    _euler.set(0, sampled.yaw, 0);
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
