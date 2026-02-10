import { ENGINE_PHYSICS, DEG2RAD as _DEG2RAD, RAD2DEG as _RAD2DEG } from '../../../engine/physics/constants';
import type { WeaponType } from './types';

/** Full physics constants = engine core + Velocity-specific game balance. */
export const PHYSICS = {
  ...ENGINE_PHYSICS,

  // ── Rocket launcher ──
  ROCKET_SPEED: 180,
  ROCKET_RADIUS: 0.15,
  ROCKET_EXPLOSION_RADIUS: 8,   // blast radius in game units
  ROCKET_KNOCKBACK_FORCE: 120,  // knockback force — toned down for controlled rocket jumps
  ROCKET_SELF_DAMAGE_MULT: 0.5,
  ROCKET_DAMAGE: 100,
  ROCKET_FIRE_COOLDOWN: 0.8, // seconds

  // ── Grenades ──
  GRENADE_SPEED: 600,
  GRENADE_RADIUS: 0.12,
  GRENADE_FUSE_TIME: 2.5,
  GRENADE_BOUNCE_DAMPING: 0.6,
  GRENADE_EXPLOSION_RADIUS: 7,  // blast radius in game units
  GRENADE_KNOCKBACK_FORCE: 110, // knockback force — toned down for grenade jumps
  GRENADE_DAMAGE: 80,
  GRENADE_FIRE_COOLDOWN: 0.6,

  // ── Health ──
  HEALTH_MAX: 100,
  HEALTH_REGEN_DELAY: 3.0,  // seconds after last damage
  HEALTH_REGEN_RATE: 15,    // hp/s

  // ── Sniper rifle (hitscan) ──
  SNIPER_DAMAGE: 200,
  SNIPER_RANGE: 500,
  SNIPER_KNOCKBACK: 40,         // small self-knockback backward
  SNIPER_FIRE_COOLDOWN: 2.0,
  SNIPER_ZOOM_FOV: 30,
  SNIPER_MAX_AMMO: 10,

  // ── Assault rifle (hitscan) ──
  ASSAULT_DAMAGE: 12,
  ASSAULT_RANGE: 300,
  ASSAULT_SPREAD: 0.03,         // radians — cone spread
  ASSAULT_FIRE_COOLDOWN: 0.08,  // ~12.5 rounds/sec
  ASSAULT_KNOCKBACK: 15,
  ASSAULT_MAX_AMMO: 120,
  ASSAULT_MAG_SIZE: 30,

  // ── Shotgun (hitscan, multi-pellet) ──
  SHOTGUN_PELLETS: 8,
  SHOTGUN_DAMAGE_PER_PELLET: 15,
  SHOTGUN_RANGE: 80,
  SHOTGUN_SPREAD: 0.1,          // radians — wide cone
  SHOTGUN_KNOCKBACK: 40,        // moderate push
  SHOTGUN_SELF_KNOCKBACK: 70,   // self-boost for shotgun jumping
  SHOTGUN_JUMP_UPLIFT: 60,     // min upward velocity when shotgun-jumping while grounded
  SHOTGUN_FIRE_COOLDOWN: 0.9,
  SHOTGUN_MAX_AMMO: 24,

  // ── Knife (melee) ──
  KNIFE_DAMAGE: 50,
  KNIFE_RANGE: 3.5,
  KNIFE_LUNGE_SPEED: 30,        // very short lunge
  KNIFE_LUNGE_DURATION: 0.08,   // seconds
  KNIFE_FIRE_COOLDOWN: 0.4,

  // ── Plasma gun (continuous beam) ──
  PLASMA_DAMAGE_PER_SEC: 80,
  PLASMA_RANGE: 60,
  PLASMA_PUSHBACK: 90,          // push force on self (plasma surf boost)
  PLASMA_SURF_FRICTION_MULT: 0.3, // reduced friction while plasma surfing
  PLASMA_AMMO_PER_SEC: 10,
  PLASMA_MAX_AMMO: 100,

  // ── Aim Down Sights (ADS) ──
  ADS_TRANSITION_SPEED: 8,       // lerp speed for hip↔ADS transition
  ADS_SPEED_MULT: 0.6,           // movement speed multiplier when fully ADS

  // ── Weapon switching ──
  WEAPON_SWAP_TIME: 0.3,        // seconds to switch weapons

  // ── Edge grab / mantling ──
  MANTLE_FORWARD_DIST: 0.8,       // raycast forward distance to detect wall
  MANTLE_UP_CHECK: 2.0,           // how far above eye level to check for ledge top
  MANTLE_DOWN_CHECK: 1.5,         // how far down from ledge-check ray to find surface
  MANTLE_MAX_HEIGHT: 2.5,         // max ledge height above feet (prevents mantling cliffs)
  MANTLE_MIN_HEIGHT: 0.5,         // min height (below = autostep handles it)
  MANTLE_DURATION: 0.2,           // seconds for mantle lerp
  MANTLE_SPEED_BOOST: 80,         // forward speed after mantle
  MANTLE_COOLDOWN: 0.3,           // seconds before can mantle again
  MANTLE_MIN_APPROACH_SPEED: 50,  // must be moving toward wall
} as const;

export { _DEG2RAD as DEG2RAD, _RAD2DEG as RAD2DEG };

/** Per-weapon ADS configuration. Weapons with canAds=false ignore ADS input. */
export interface AdsWeaponConfig {
  fov: number;
  canAds: boolean;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
}

export const ADS_CONFIG: Record<WeaponType, AdsWeaponConfig> = {
  sniper:  { fov: 30,  canAds: true,  anchorX: 0,    anchorY: -0.10, anchorZ: -0.25 },
  assault: { fov: 55,  canAds: true,  anchorX: 0,    anchorY: -0.10, anchorZ: -0.25 },
  shotgun: { fov: 60,  canAds: true,  anchorX: 0,    anchorY: -0.10, anchorZ: -0.25 },
  rocket:  { fov: 90,  canAds: false, anchorX: 0.05, anchorY: -0.30, anchorZ: -0.10 },
  grenade: { fov: 90,  canAds: false, anchorX: 0.05, anchorY: -0.30, anchorZ: -0.10 },
  plasma:  { fov: 90,  canAds: false, anchorX: 0.05, anchorY: -0.30, anchorZ: -0.10 },
  knife:   { fov: 90,  canAds: false, anchorX: 0.05, anchorY: -0.30, anchorZ: -0.10 },
} as const;
