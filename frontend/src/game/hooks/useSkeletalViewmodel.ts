/**
 * Hook that manages loading the first-person arms GLB (with skeleton + animations)
 * and the current weapon GLB for bone socket attachment.
 *
 * Arms model is loaded once and persisted across weapon switches.
 * Only the weapon attachment changes when the active weapon changes.
 *
 * Depends on: assetManager, combatStore, viewmodelConfig, devLogStore
 * Used by: SkeletalViewmodel
 */
import { useState, useEffect, useRef } from 'react';
import type { Group, AnimationClip } from 'three/webgpu';
import { loadModel, loadModelWithAnimations } from '@game/services/assetManager';
import { useCombatStore } from '@game/stores/combatStore';
import { ARMS_MODEL, WEAPON_MODELS } from '@game/components/game/viewmodelConfig';
import { devLog } from '@engine/stores/devLogStore';

export interface SkeletalViewmodelState {
  armsScene: Group | null;
  armsClips: AnimationClip[];
  weaponScene: Group | null;
  isLoading: boolean;
}

export function useSkeletalViewmodel(): SkeletalViewmodelState {
  const [armsScene, setArmsScene] = useState<Group | null>(null);
  const [armsClips, setArmsClips] = useState<AnimationClip[]>([]);
  const [weaponScene, setWeaponScene] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const cancelRef = useRef(false);

  // Load arms model once
  useEffect(() => {
    let cancelled = false;
    devLog.info('SkeletalVM', `Loading arms model: ${ARMS_MODEL.PATH}...`);

    loadModelWithAnimations(ARMS_MODEL.PATH).then((asset) => {
      if (cancelled) return;
      asset.scene.scale.setScalar(ARMS_MODEL.SCALE);
      setArmsScene(asset.scene);
      setArmsClips(asset.animations);
      setIsLoading(false);
      devLog.info('SkeletalVM', `Arms loaded: ${asset.animations.length} clips, ${asset.scene.children.length} children`);
    }).catch((err) => {
      if (cancelled) return;
      devLog.error('SkeletalVM', `Arms load failed: ${err}`);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // Load weapon model when active weapon changes
  useEffect(() => {
    cancelRef.current = true;
    cancelRef.current = false;

    const config = WEAPON_MODELS[activeWeapon];
    const weaponPath = config.socketWeaponPath ?? config.path;

    if (!weaponPath) {
      setWeaponScene(null);
      return;
    }

    devLog.info('SkeletalVM', `Loading weapon: ${weaponPath}...`);
    const localCancel = { value: false };

    loadModel(weaponPath).then((scene) => {
      if (localCancel.value) return;
      const scale = config.socketWeaponScale ?? config.scale;
      scene.scale.setScalar(scale);
      setWeaponScene(scene);
      devLog.info('SkeletalVM', `Weapon loaded: ${scene.children.length} children`);
    }).catch((err) => {
      if (localCancel.value) return;
      devLog.error('SkeletalVM', `Weapon load failed: ${err}`);
    });

    return () => { localCancel.value = true; };
  }, [activeWeapon]);

  return { armsScene, armsClips, weaponScene, isLoading };
}
