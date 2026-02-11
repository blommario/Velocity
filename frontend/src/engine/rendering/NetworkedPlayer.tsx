/**
 * Generic networked player — renders a loaded Three.js Group at an
 * interpolated network position. Game layer injects model + snapshot via props.
 * Caches cloned graph and mutates materials directly to avoid scene graph churn.
 *
 * Depends on: R3F, Three.js, NetworkInterpolator
 * Used by: game RemotePlayers (via prop injection)
 */
import { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Euler, MeshStandardMaterial, Color, Mesh } from 'three';
import { NetworkInterpolator, type NetSnapshot } from '../networking/NetworkInterpolator';

const _euler = new Euler(0, 0, 0, 'YXZ');
const _color = new Color();

export interface NetworkedPlayerProps {
  /** Current snapshot from network. */
  snapshot: NetSnapshot | null;
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
  /** Network tick interval in ms (default 50 = 20Hz). */
  intervalMs?: number;
}

export function NetworkedPlayer({
  snapshot,
  model,
  modelScale,
  yOffset = 0,
  color,
  emissiveIntensity = 0.6,
  intervalMs = 50,
}: NetworkedPlayerProps) {
  const groupRef = useRef<Group>(null);
  const interpRef = useRef(new NetworkInterpolator(intervalMs));

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

  // Push new snapshots into the interpolator
  useEffect(() => {
    if (snapshot) interpRef.current.push(snapshot);
  }, [snapshot]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const sampled = interpRef.current.sample();

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
