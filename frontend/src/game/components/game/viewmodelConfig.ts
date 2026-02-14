/**
 * Viewmodel configuration — weapon colors, muzzle flash colors, 3D model
 * paths/transforms, anchor constants, and skeletal animation settings.
 *
 * Depends on: (none — pure data)
 * Used by: Viewmodel, SkeletalViewmodel, ViewmodelContent
 */
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
  pistol: '#666655',
} as const;

export const MUZZLE_COLORS: Record<WeaponType, [number, number, number]> = {
  rocket: [1.0, 0.5, 0.1],
  grenade: [0.5, 1.0, 0.2],
  sniper: [0.8, 0.8, 1.0],
  assault: [1.0, 0.7, 0.2],
  shotgun: [1.0, 0.6, 0.1],
  knife: [0, 0, 0],
  plasma: [0.3, 0.6, 1.0],
  pistol: [1.0, 0.8, 0.3],
} as const;

export interface WeaponModelConfig {
  path: string | null;
  scale: number;
  rotationY: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  /** If true, use skeletal arms model instead of standalone weapon model. */
  skeletal?: boolean;
  /** Weapon GLB path for bone socket attachment (skeletal mode). */
  socketWeaponPath?: string | null;
  /** Weapon scale when attached to bone socket. */
  socketWeaponScale?: number;
  /** Socket position offset from bone origin. */
  socketOffsetX?: number;
  socketOffsetY?: number;
  socketOffsetZ?: number;
  /** Socket rotation offset (radians). */
  socketRotX?: number;
  socketRotY?: number;
  socketRotZ?: number;
  /** Bone name in weapon model for muzzle flash origin. */
  muzzleBoneName?: string;
}

export const WEAPON_MODELS: Record<WeaponType, WeaponModelConfig> = {
  assault: { path: 'weapons/rifle.glb', scale: 0.065, rotationY: Math.PI / 2, offsetX: 0.00, offsetY: -0.02, offsetZ: -0.35, skeletal: true, socketWeaponScale: 0.065, socketOffsetX: 0.02, socketOffsetY: -0.01, socketOffsetZ: -0.08, socketRotX: 0, socketRotY: Math.PI / 2, socketRotZ: 0 },
  sniper:  { path: 'weapons/sniper.glb', scale: 0.50, rotationY: Math.PI / 2, offsetX: 0.00, offsetY: -0.02, offsetZ: -0.35, skeletal: true, socketWeaponScale: 0.50, socketOffsetX: 0.02, socketOffsetY: -0.01, socketOffsetZ: -0.08, socketRotX: 0, socketRotY: Math.PI / 2, socketRotZ: 0 },
  shotgun: { path: 'weapons/rifle.glb', scale: 0.065, rotationY: Math.PI / 2, offsetX: 0.00, offsetY: -0.02, offsetZ: -0.35, skeletal: true, socketWeaponScale: 0.065, socketOffsetX: 0.02, socketOffsetY: -0.01, socketOffsetZ: -0.08, socketRotX: 0, socketRotY: Math.PI / 2, socketRotZ: 0 },
  rocket:  { path: 'weapons/rocket_launcher.glb', scale: 0.065, rotationY: Math.PI, offsetX: 0.00, offsetY: -0.10, offsetZ: -0.35, skeletal: true, socketWeaponScale: 0.065, socketOffsetX: 0.02, socketOffsetY: -0.02, socketOffsetZ: -0.10, socketRotX: 0, socketRotY: Math.PI, socketRotZ: 0 },
  grenade: { path: null, scale: 1, rotationY: 0, offsetX: 0, offsetY: 0, offsetZ: -0.25, skeletal: true },
  plasma:  { path: null, scale: 1, rotationY: 0, offsetX: 0, offsetY: 0, offsetZ: -0.25, skeletal: true },
  knife:   { path: 'weapons/knife.glb', scale: 0.35, rotationY: -Math.PI / 2, offsetX: 0.00, offsetY: -0.05, offsetZ: -0.35, skeletal: true, socketWeaponScale: 0.35, socketOffsetX: 0.01, socketOffsetY: 0.0, socketOffsetZ: -0.03, socketRotX: 0, socketRotY: -Math.PI / 2, socketRotZ: 0 },
  pistol:  { path: null, scale: 1, rotationY: 0, offsetX: 0, offsetY: 0, offsetZ: -0.25, skeletal: true },
} as const;

// ── Skeletal animation configuration ──

/** First-person arms model with skeleton. */
export const ARMS_MODEL = {
  PATH: 'viewmodel/fp_arms.glb',
  SCALE: 1.0,
  BONE_NAME: 'handR',
} as const;

/** Animation clip name mapping for the arms model. */
export const SKELETAL_CLIPS = {
  IDLE: 'Combat_idle_loop',
  IDLE_START: 'Combat_idle_start',
  FIRE: 'Combat_punch_right',
  FIRE_ALT: 'Combat_punch_left',
  HOLSTER: 'Hands_below',
  RELOAD: 'Magic_spell_attack',
  INSPECT: 'Collect_something',
  IDLE_RELAXED: 'Relax_hands_idle_loop',
} as const;

/** Per-weapon overrides for skeletal animation clip names and playback speed. */
export interface SkeletalAnimOverrides {
  fireClip?: string;
  reloadClip?: string;
  drawClip?: string;
  inspectClip?: string;
  fireSpeed?: number;
  reloadSpeed?: number;
}

export const SKELETAL_OVERRIDES: Partial<Record<WeaponType, SkeletalAnimOverrides>> = {
  knife: { fireClip: 'Combat_punch_left' },
} as const;
