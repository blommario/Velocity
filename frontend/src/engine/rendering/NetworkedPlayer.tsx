/**
 * Generic networked player — renders a loaded Three.js Group at an
 * interpolated network position. Reads directly from RemotePlayerInterpolators
 * in useFrame (60Hz) — no React re-renders needed for position updates.
 *
 * Depends on: R3F, Three.js, RemotePlayerInterpolators
 * Used by: game RemotePlayers (via prop injection)
 */
import { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Euler, MeshStandardMaterial, Color, Mesh } from 'three';
import { getInterpolator } from '../networking/RemotePlayerInterpolators';

const _euler = new Euler(0, 0, 0, 'YXZ');
const _color = new Color();

export interface NetworkedPlayerProps {
  /** Remote player ID — used to look up interpolator. */
  playerId: string;
  /** Pre-loaded model Group (will be cloned internally). */
  model: Group;
  /** Uniform scale to apply (game layer computes from model height → player height). */
  modelScale: number;
  /** Y offset added to network position (e.g. -halfHeight when position is body center but model origin is feet). */
  yOffset?: number;
  /** Display color (CSS string). */
  color: string;
  /** Emissive intensity. */
  emissiveIntensity?: number;
}

export function NetworkedPlayer({
  playerId,
  model,
  modelScale,
  yOffset = 0,
  color,
  emissiveIntensity = 0.6,
}: NetworkedPlayerProps) {
  const groupRef = useRef<Group>(null);

  // Clone model hierarchy once (or when base model changes)
  const clonedScene = useMemo(() => model.clone(), [model]);

  // Create material once
  const customMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      transparent: true,
      opacity: 0.85,
      depthWrite: true,
    });
  }, []);

  // Mutate material props when color/emissive changes — no re-clone
  useLayoutEffect(() => {
    _color.set(color);
    customMaterial.color.set(_color);
    customMaterial.emissive.set(_color);
    customMaterial.emissiveIntensity = emissiveIntensity;

    clonedScene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.material !== customMaterial) {
          mesh.material = customMaterial;
        }
      }
    });
  }, [clonedScene, customMaterial, color, emissiveIntensity]);

  // Dispose material on unmount
  useEffect(() => {
    return () => { customMaterial.dispose(); };
  }, [customMaterial]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const interp = getInterpolator(playerId);
    if (!interp) {
      if (group.visible) group.visible = false;
      return;
    }

    const sampled = interp.sample();
    if (!sampled) {
      if (group.visible) group.visible = false;
      return;
    }

    if (!group.visible) group.visible = true;

    group.position.set(sampled.position[0], sampled.position[1] + yOffset, sampled.position[2]);
    _euler.set(0, sampled.yaw + Math.PI, 0);
    group.rotation.copy(_euler);
  });

  return (
    <group ref={groupRef} visible={false} scale={[modelScale, modelScale, modelScale]}>
      <primitive object={clonedScene} />
    </group>
  );
}
