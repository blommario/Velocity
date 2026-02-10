/**
 * Viewmodel configuration — weapon colors, muzzle flash colors, 3D model
 * paths/transforms, and anchor constants.
 *
 * Depends on: (none — pure data)
 * Used by: Viewmodel, ViewmodelContent
 */
import { BoxGeometry } from 'three';
import type { WeaponType } from './physics/types';

/** Anchor position and focal distance — all in camera-local space. */
export const VM_ANCHOR = {
  X: 0.05,
  Y: -0.30,
  Z: -0.10,
  /** Shorter = snappier aim feel, longer = subtler. 8 is a good middle ground. */
  FOCAL_DIST: 8.0,
} as const;

/** Multipliers for game feel. */
export const SWAY_INTENSITY = 2.0;
export const TILT_INTENSITY = 0.8;

export const WEAPON_COLORS: Record<WeaponType, string> = {
  rocket: '#884422',
  grenade: '#446622',
  sniper: '#334466',
  assault: '#555555',
  shotgun: '#664422',
  knife: '#888888',
  plasma: '#224466',
} as const;

export const MUZZLE_COLORS: Record<WeaponType, [number, number, number]> = {
  rocket: [1.0, 0.5, 0.1],
  grenade: [0.5, 1.0, 0.2],
  sniper: [0.8, 0.8, 1.0],
  assault: [1.0, 0.7, 0.2],
  shotgun: [1.0, 0.6, 0.1],
  knife: [0, 0, 0],
  plasma: [0.3, 0.6, 1.0],
} as const;

export interface WeaponModelConfig {
  path: string | null;
  scale: number;
  rotationY: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export const WEAPON_MODELS: Record<WeaponType, WeaponModelConfig> = {
  assault: { path: 'weapons/rifle.glb', scale: 0.065, rotationY: Math.PI / 2, offsetX: 0.00, offsetY: -0.02, offsetZ: -0.35 },
  sniper:  { path: 'weapons/rifle.glb', scale: 0.065, rotationY: Math.PI / 2, offsetX: 0.00, offsetY: -0.02, offsetZ: -0.35 },
  shotgun: { path: 'weapons/rifle.glb', scale: 0.065, rotationY: Math.PI / 2, offsetX: 0.00, offsetY: -0.02, offsetZ: -0.35 },
  rocket:  { path: 'weapons/rocket_launcher.glb', scale: 0.065, rotationY: Math.PI, offsetX: 0.00, offsetY: -0.10, offsetZ: -0.35 },
  grenade: { path: null, scale: 1, rotationY: 0, offsetX: 0, offsetY: 0, offsetZ: -0.25 },
  plasma:  { path: null, scale: 1, rotationY: 0, offsetX: 0, offsetY: 0, offsetZ: -0.25 },
  knife:   { path: null, scale: 1, rotationY: 0, offsetX: 0, offsetY: 0, offsetZ: -0.20 },
} as const;

export const knifeGeometry = new BoxGeometry(0.02, 0.02, 0.3);
