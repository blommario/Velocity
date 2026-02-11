/**
 * Instanced block group using TSL procedural materials with time animation.
 *
 * Depends on: proceduralMaterials, blockUtils, R3F useFrame
 * Used by: map renderer
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { createProceduralMaterial } from './proceduralMaterials';
import type { ProceduralMaterialConfig } from './proceduralMaterials';
import { useInstanceMatrix, getGeometry, useLightingBinding } from './blockUtils';
import type { BlockGroupProps } from './blockUtils';

export function ProceduralBlockGroup({ group, cylinderSegments, lightsNode, tileLightingNode }: BlockGroupProps) {
  const meshRef = useInstanceMatrix(group.blocks);
  const geometry = getGeometry(group.shape, cylinderSegments);

  const { material, timeUniform } = useMemo(() => {
    const config: ProceduralMaterialConfig = {
      type: group.proceduralMaterial!,
      color: group.color,
      roughnessOverride: group.roughness,
      metalnessOverride: group.metalness,
      emissive: group.emissive !== '#000000' ? group.emissive : undefined,
      emissiveIntensity: group.emissiveIntensity || undefined,
      emissiveAnimation: group.emissiveAnimation,
      emissiveAnimationSpeed: group.emissiveAnimationSpeed,
      scaleX: group.textureScale?.[0],
      scaleY: group.textureScale?.[1],
      blendType: group.blendProceduralMaterial,
      blendMode: group.blendMode,
      blendHeight: group.blendHeight,
      blendSharpness: group.blendSharpness,
    };
    return createProceduralMaterial(config);
  }, [group]);

  useLightingBinding(meshRef, lightsNode, tileLightingNode);

  // Set absolute time — safe even if multiple groups share the same cached material
  useFrame((state) => {
    if (timeUniform) timeUniform.value = state.clock.elapsedTime;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, group.blocks.length]}
      castShadow
      receiveShadow
      frustumCulled
    />
  );
}
