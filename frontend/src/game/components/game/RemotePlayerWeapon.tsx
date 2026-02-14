/**
 * Renders a weapon model attached to a remote player's RightHand bone.
 *
 * Reads weapon type from remotePlayerWeapons map (set by weapon_switch events),
 * loads the matching GLB via assetManager, and follows the bone transform each frame.
 *
 * Depends on: assetManager, multiplayerStore, R3F useFrame
 * Used by: RemotePlayers
 */
import { useState, useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, Bone } from 'three';
import { MeshStandardMaterial, Color, Vector3, Quaternion, Matrix4 } from 'three';
import { loadModel } from '@game/services/assetManager';
import { remotePlayerWeapons } from '@game/stores/multiplayerStore';
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
const _worldPos = new Vector3();
const _worldQuat = new Quaternion();
const _worldScale = new Vector3();

export function RemotePlayerWeapon({ playerId, clonedScene, color }: RemotePlayerWeaponProps) {
  const [weaponScene, setWeaponScene] = useState<Group | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const materialRef = useRef<MeshStandardMaterial | null>(null);
  const boneRef = useRef<Bone | null>(null);
  const weaponGroupRef = useRef<Group>(null);

  // Create shared material for weapon coloring
  const weaponMaterial = useMemo(() => {
    const mat = new MeshStandardMaterial({
      transparent: false,
      depthWrite: true,
    });
    materialRef.current = mat;
    return mat;
  }, []);

  // Find bone in cloned scene
  useEffect(() => {
    boneRef.current = null;
    if (!clonedScene) return;

    clonedScene.traverse((child) => {
      if ((child as Bone).isBone && child.name === WEAPON_BONE) {
        boneRef.current = child as Bone;
      }
    });

    if (boneRef.current) {
      devLog.info('RemoteWeapon', `Found bone "${WEAPON_BONE}" for ${playerId.slice(0, 8)}`);
    } else {
      devLog.warn('RemoteWeapon', `Bone "${WEAPON_BONE}" not found for ${playerId.slice(0, 8)}`);
    }
  }, [clonedScene, playerId]);

  // Poll weapon type from the mutable map
  const [weaponType, setWeaponType] = useState<string | null>(null);

  useEffect(() => {
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
    weaponScene.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);

    weaponScene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        (child as Mesh).material = weaponMaterial;
        (child as Mesh).frustumCulled = false;
      }
    });
  }, [weaponScene, config, weaponMaterial]);

  // Dispose material on unmount
  useEffect(() => {
    return () => { materialRef.current?.dispose(); };
  }, []);

  // Follow bone world transform every frame
  useFrame(() => {
    const bone = boneRef.current;
    const group = weaponGroupRef.current;
    if (!bone || !group) return;

    // Get bone world transform
    bone.updateWorldMatrix(true, false);
    bone.matrixWorld.decompose(_worldPos, _worldQuat, _worldScale);

    group.position.copy(_worldPos);
    group.quaternion.copy(_worldQuat);
    // Use weapon scale directly (not bone scale)
  });

  if (!weaponScene || !config) return null;

  return (
    <group ref={weaponGroupRef} frustumCulled={false}>
      <primitive object={weaponScene} />
    </group>
  );
}
