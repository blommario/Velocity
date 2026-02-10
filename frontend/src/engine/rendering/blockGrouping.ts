/**
 * Block grouping — groups map blocks by visual properties (shape, color,
 * material, texture) for instanced rendering with minimal draw calls.
 *
 * Depends on: MapBlock type
 * Used by: InstancedBlocks
 */
import type { MapBlock } from '../types/map';
import type { BlockGroup } from './blockUtils';

export function groupBlocks(blocks: MapBlock[]): BlockGroup[] {
  const groups = new Map<string, BlockGroup>();

  for (const block of blocks) {
    const emissive = block.emissive ?? '#000000';
    const emissiveIntensity = block.emissiveIntensity ?? 0;
    const transparent = block.transparent ?? false;
    const opacity = block.opacity ?? 1;
    const textureSet = block.textureSet ?? '';
    const textureScale = block.textureScale ?? [1, 1];
    const roughness = block.roughness;
    const metalness = block.metalness;
    const proc = block.proceduralMaterial ?? '';
    const emAnim = block.emissiveAnimation ?? '';
    const emAnimSpeed = block.emissiveAnimationSpeed ?? 1;
    const blendTs = block.blendTextureSet ?? '';
    const blendProc = block.blendProceduralMaterial ?? '';
    const blendMode = block.blendMode ?? '';
    const blendH = block.blendHeight ?? '';
    const blendS = block.blendSharpness ?? '';

    const key = `${block.shape}|${block.color}|${emissive}|${emissiveIntensity}|${transparent}|${opacity}|${textureSet}|${textureScale[0]},${textureScale[1]}|${roughness ?? ''}|${metalness ?? ''}|${proc}|${emAnim}|${emAnimSpeed}|${blendTs}|${blendProc}|${blendMode}|${blendH}|${blendS}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        shape: block.shape,
        color: block.color,
        emissive,
        emissiveIntensity,
        transparent,
        opacity,
        textureSet: textureSet || undefined,
        textureScale: block.textureScale,
        roughness: block.roughness,
        metalness: block.metalness,
        proceduralMaterial: block.proceduralMaterial,
        emissiveAnimation: block.emissiveAnimation,
        emissiveAnimationSpeed: block.emissiveAnimationSpeed,
        blendTextureSet: block.blendTextureSet,
        blendProceduralMaterial: block.blendProceduralMaterial,
        blendMode: block.blendMode,
        blendHeight: block.blendHeight,
        blendSharpness: block.blendSharpness,
        blocks: [],
      };
      groups.set(key, group);
    }
    group.blocks.push(block);
  }

  return Array.from(groups.values());
}
