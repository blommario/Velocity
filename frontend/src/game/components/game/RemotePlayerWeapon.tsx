/**
 * Renders a weapon model attached to a remote player's RightHand bone.
 *
 * Reads weapon type from remotePlayerWeapons map (set by weapon_switch events),
 * loads the matching GLB via assetManager, and attaches it via useBoneSocket.
 *
 * Depends on: useBoneSocket, assetManager, multiplayerStore, viewmodelConfig, WeaponType
 * Used by: RemotePlayers
 */
import { useState, useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { MeshStandardMaterial, Color } from 'three';
import { useBoneSocket } from '@engine/effects/useBoneSocket';
import { loadModel } from '@game/services/assetManager';
import { remotePlayerWeapons } from '@game/stores/multiplayerStore';
import { WEAPON_MODELS } from './viewmodelConfig';
import type { WeaponType } from './physics/types';
import { devLog } from '@engine/stores/devLogStore';

/** Bone name on the Quaternius animated player model for weapon attachment. */
const WEAPON_BONE = 'RightHand';

/** Third-person weapon config — scale/offset/rotation tuned for the remote player model. */
const REMOTE_WEAPON_CONFIG: Record<string, {
  path: string;
  scale: number;
  offset: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}> = {
  assault: {
    path: 'weapons/rifle.glb',
    scale: 0.065,
    offset: { x: 0.02, y: -0.01, z: -0.08 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
  },
  shotgun: {
    path: 'weapons/rifle.glb',
    scale: 0.065,
    offset: { x: 0.02, y: -0.01, z: -0.08 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
  },
  sniper: {
    path: 'weapons/sniper.glb',
    scale: 0.50,
    offset: { x: 0.02, y: -0.01, z: -0.08 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
  },
  rocket: {
    path: 'weapons/rocket_launcher.glb',
    scale: 0.065,
    offset: { x: 0.02, y: -0.02, z: -0.10 },
    rotation: { x: 0, y: Math.PI, z: 0 },
  },
  knife: {
    path: 'weapons/knife.glb',
    scale: 0.35,
    offset: { x: 0.01, y: 0.0, z: -0.03 },
    rotation: { x: 0, y: -Math.PI / 2, z: 0 },
  },
} as const;

/** Weapons that have no 3D model (fists/throwable). */
const NO_MODEL_WEAPONS: ReadonlySet<string> = new Set(['grenade', 'plasma', 'pistol']);

interface RemotePlayerWeaponProps {
  playerId: string;
  clonedScene: Group;
  color: string;
}

const _color = new Color();

export function RemotePlayerWeapon({ playerId, clonedScene, color }: RemotePlayerWeaponProps) {
  const [weaponScene, setWeaponScene] = useState<Group | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const materialRef = useRef<MeshStandardMaterial | null>(null);

  // Poll weapon type from the mutable map (changes rarely — ~0.5Hz at most)
  const [weaponType, setWeaponType] = useState<string | null>(null);

  useEffect(() => {
    // Check weapon on mount and set up a polling interval
    const check = () => {
      const w = remotePlayerWeapons.get(playerId) ?? null;
      setWeaponType((prev) => (prev !== w ? w : prev));
    };
    check();
    const id = setInterval(check, 250);
    return () => clearInterval(id);
  }, [playerId]);

  // Resolve config for current weapon
  const config = weaponType && !NO_MODEL_WEAPONS.has(weaponType)
    ? REMOTE_WEAPON_CONFIG[weaponType] ?? null
    : null;

  // Load weapon model when config changes
  useEffect(() => {
    if (!config) {
      currentPathRef.current = null;
      setWeaponScene(null);
      return;
    }

    const { path } = config;
    if (path === currentPathRef.current) return;
    currentPathRef.current = path;

    let cancelled = false;
    loadModel(path)
      .then((scene) => {
        if (cancelled) return;
        devLog.info('RemoteWeapon', `Loaded ${path} for ${playerId.slice(0, 8)}`);
        setWeaponScene(scene);
      })
      .catch((err) => {
        if (!cancelled) {
          devLog.error('RemoteWeapon', `Failed to load ${path}: ${err}`);
        }
      });

    return () => { cancelled = true; };
  }, [config?.path, playerId]);

  // Create shared material for weapon coloring
  const weaponMaterial = useMemo(() => {
    const mat = new MeshStandardMaterial({
      transparent: false,
      depthWrite: true,
    });
    materialRef.current = mat;
    return mat;
  }, []);

  // Update material color when player color changes
  useLayoutEffect(() => {
    _color.set(color);
    weaponMaterial.color.set(_color);
    weaponMaterial.emissive.set(_color);
    weaponMaterial.emissiveIntensity = 0.4;
  }, [color, weaponMaterial]);

  // Apply material + scale to loaded weapon scene
  useLayoutEffect(() => {
    if (!weaponScene || !config) return;

    weaponScene.scale.setScalar(config.scale);

    weaponScene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        (child as Mesh).material = weaponMaterial;
      }
    });
  }, [weaponScene, config, weaponMaterial]);

  // Dispose material on unmount
  useEffect(() => {
    return () => { materialRef.current?.dispose(); };
  }, []);

  // Attach weapon to bone
  useBoneSocket({
    root: clonedScene,
    boneName: WEAPON_BONE,
    attachment: weaponScene,
    offset: config?.offset,
    rotation: config?.rotation,
  });

  return null;
}
