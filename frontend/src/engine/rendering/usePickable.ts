/**
 * React hook for GPU color picking integration.
 *
 * Manages a GpuPicker instance, provides registration hooks for meshes,
 * and handles pick queries on left-click via useRtsInput.
 *
 * Engine-level: no game store imports.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import type { Object3D, InstancedMesh, Scene } from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { GpuPicker, type PickResult } from './GpuPicker';
import { devLog } from '../stores/devLogStore';

/** Callback invoked when a pickable object is clicked. */
export type OnPickCallback = (result: PickResult | null) => void;

export interface UseGpuPickingConfig {
  /** Whether picking is active. Default true. */
  enabled?: boolean;
  /** Called after each pick attempt (hit or miss). */
  onPick?: OnPickCallback;
}

/**
 * Creates and manages a GpuPicker instance.
 *
 * Returns:
 *  - `picker`: the GpuPicker instance (for register/unregister)
 *  - `pickAt`: manual pick at screen coords
 *
 * The picker is stable across re-renders (created once, disposed on unmount).
 */
export function useGpuPicking(config?: UseGpuPickingConfig) {
  const { gl, camera, scene } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const pickerRef = useRef<GpuPicker | null>(null);

  // Initialize picker on mount
  if (!pickerRef.current) {
    pickerRef.current = new GpuPicker();
  }
  const picker = pickerRef.current;

  // Cleanup on unmount
  useEffect(() => {
    devLog.info('Picking', `GPU picker initialized`);
    return () => {
      pickerRef.current?.dispose();
      pickerRef.current = null;
      devLog.info('Picking', 'GPU picker disposed');
    };
  }, []);

  /** Pick at arbitrary screen coordinates. */
  const pickAt = useCallback(
    async (screenX: number, screenY: number): Promise<PickResult | null> => {
      if (!pickerRef.current) return null;
      return pickerRef.current.pick(screenX, screenY, camera, renderer, scene as Scene);
    },
    [camera, renderer, scene],
  );

  return { picker, pickAt };
}

/**
 * Register a mesh (or Object3D) as pickable for the lifetime of the component.
 *
 * Automatically unregisters on unmount. Returns the assigned pick ID.
 */
export function usePickable(
  picker: GpuPicker | null,
  objectRef: React.RefObject<Object3D | null>,
): number {
  const idRef = useRef(0);

  useEffect(() => {
    const obj = objectRef.current;
    if (!picker || !obj) return;

    idRef.current = picker.register(obj);

    return () => {
      if (obj) picker.unregister(obj);
      idRef.current = 0;
    };
  }, [picker, objectRef]);

  return idRef.current;
}

/**
 * Register multiple instances of an InstancedMesh as individually pickable.
 *
 * Returns an array of pick IDs (one per instance index in `range`).
 */
export function usePickableInstances(
  picker: GpuPicker | null,
  meshRef: React.RefObject<InstancedMesh | null>,
  instanceCount: number,
): number[] {
  const idsRef = useRef<number[]>([]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!picker || !mesh || instanceCount <= 0) return;

    const ids: number[] = [];
    for (let i = 0; i < instanceCount; i++) {
      ids.push(picker.registerInstance(mesh, i));
    }
    idsRef.current = ids;

    return () => {
      picker.unregisterIds(idsRef.current);
      idsRef.current = [];
    };
  }, [picker, meshRef, instanceCount]);

  return idsRef.current;
}
