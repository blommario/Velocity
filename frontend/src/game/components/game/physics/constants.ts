import { ENGINE_PHYSICS, DEG2RAD as _DEG2RAD, RAD2DEG as _RAD2DEG } from '@engine/physics/constants';
import type { RecoilPattern, RecoilConfig } from '@engine/physics/recoil';
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
  GRENADE_SELF_DAMAGE_MULT: 0.6, // self-damage fraction (grenades hurt more than rockets at close range)
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

  // ── Sniper scope ──
  SCOPE_SWAY_BASE: 0.012,        // base sway amplitude (fraction of screen)
  SCOPE_SWAY_SPEED: 1.4,         // base oscillation speed
  SCOPE_SWAY_MOUSE_MULT: 0.08,   // mouse movement amplifies sway
  SCOPE_BREATH_HOLD_DURATION: 2.0, // seconds of stable breath hold
  SCOPE_BREATH_PENALTY_MULT: 2.5,  // sway multiplier after breath hold expires
  SCOPE_STABLE_TIME: 3.0,        // seconds fully stable when scoped
  SCOPE_DRIFT_TIME: 6.0,         // seconds until drift becomes severe (3-6s = drifting)
  SCOPE_FORCE_UNSCOPE_TIME: 6.0, // force unscope after this many seconds
  SCOPE_DRIFT_MULT: 3.0,         // sway multiplier at max drift

  // ── Prone accuracy ──
  PRONE_SPREAD_MULT: 0.3,      // weapon spread multiplier when prone

  // ── Recoil & spread ──
  RECOIL_RECOVERY_SPEED: 6,        // radians/sec recovery lerp
  RECOIL_RECOVERY_DELAY: 0.3,      // seconds after last shot before recovery starts
  BLOOM_DECAY_SPEED: 40,           // bloom units/sec decay
  ADS_RECOIL_MULT: 0.5,            // recoil × 0.5 when fully ADS
  PRONE_RECOIL_MULT: 0.3,          // recoil × 0.3 when prone
  MOVING_SPREAD_MULT: 1.5,         // spread × 1.5 when moving on ground
  AIR_SPREAD_MULT: 2.0,            // spread × 2.0 when airborne
  CROUCH_SPREAD_MULT: 0.7,         // spread × 0.7 when crouching

  // ── Weapon inspect ──
  INSPECT_TRANSITION_SPEED: 5,  // lerp speed for hip↔inspect transition
  INSPECT_SPIN_SPEED: 0.8,     // Y-axis rotation speed (radians/sec)

  // ── Reload ──
  RELOAD_TRANSITION_SPEED: 6,     // viewmodel lerp speed during reload
  AUTO_RELOAD_DELAY: 0.5,         // seconds before auto-reload on empty mag
  ASSAULT_RELOAD_TIME: 2.0,       // mag swap
  SNIPER_RELOAD_TIME: 2.5,
  SHOTGUN_RELOAD_TIME_PER_SHELL: 0.5, // per shell, interruptible
  PLASMA_RELOAD_TIME: 3.0,       // full recharge
  ROCKET_RELOAD_TIME: 1.5,
  GRENADE_RELOAD_TIME: 1.0,

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
  MANTLE_MAX_ENTRY_VEL_Y: 20,    // max upward velocity to start mantle

  // ── Grenade physics ──
  GRENADE_SPAWN_OFFSET: 0.8,     // spawn distance multiplier from player
  GRENADE_UPWARD_BOOST: 100,     // upward velocity added to grenade throw

  // ── Plasma physics ──
  PLASMA_JUMP_UPLIFT: 60,        // min upward velocity when plasma surfing grounded
  PLASMA_GROUND_DIR_THRESHOLD: -0.3, // fire direction Y threshold for plasma jump

  // ── Grapple aiming ──
  GRAPPLE_MIN_AIM_DOT: 0.3,      // min dot product to aim at grapple point
  GRAPPLE_MIN_DISTANCE: 1,       // min distance to grapple target

  // ── Projectile limits ──
  PROJECTILE_MAX_AGE: 8,         // seconds before projectile despawns
  PROJECTILE_VOID_Y: -60,        // Y threshold for projectile void kill

  // ── World bounds ──
  VOID_Y: -50,                   // Y threshold for player void respawn

  // ── Physics thresholds ──
  WALL_DOT_THRESHOLD: 0.3,       // dot product threshold for wall detection
  VELOCITY_CORRECTION_RATIO: 0.3, // horizontal correction ratio for wall sliding
  DOUBLE_TAP_WINDOW: 300,        // ms window for double-tap crouch→prone
  HITSCAN_SPREAD_FACTOR: 2,      // spread multiplication factor for hitscan weapons

  // ── Explosion FX ──
  ROCKET_EXPLOSION_COLOR: '#ff6600' as const,
  ROCKET_EXPLOSION_SIZE: 8.0,
  GRENADE_EXPLOSION_COLOR: '#22c55e' as const,
  GRENADE_EXPLOSION_SIZE: 3.5,

  // ── Decal params ──
  ROCKET_DECAL_RADIUS: 2.0,
  ROCKET_DECAL_LIFETIME: 0.08,
  ROCKET_DECAL_FADE_IN: 0.05,
  ROCKET_DECAL_FADE_OUT: 0.03,
  GRENADE_DECAL_RADIUS: 1.5,
  GRENADE_DECAL_LIFETIME: 0.05,
  GRENADE_DECAL_FADE_IN: 0.12,
  GRENADE_DECAL_FADE_OUT: 0.04,
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

/** Per-weapon reload configuration. */
export interface ReloadWeaponConfig {
  canReload: boolean;
  reloadTime: number;      // total seconds (or per-shell for shotgun)
  magSize: number;          // magazine capacity (Infinity = no magazine distinction)
  perShell: boolean;        // true = shotgun-style interruptible shell-by-shell reload
}

export const RELOAD_CONFIG: Record<WeaponType, ReloadWeaponConfig> = {
  assault: { canReload: true,  reloadTime: PHYSICS.ASSAULT_RELOAD_TIME,           magSize: PHYSICS.ASSAULT_MAG_SIZE, perShell: false },
  sniper:  { canReload: true,  reloadTime: PHYSICS.SNIPER_RELOAD_TIME,            magSize: 5,                         perShell: false },
  shotgun: { canReload: true,  reloadTime: PHYSICS.SHOTGUN_RELOAD_TIME_PER_SHELL, magSize: 8,                         perShell: true },
  rocket:  { canReload: true,  reloadTime: PHYSICS.ROCKET_RELOAD_TIME,            magSize: 5,                         perShell: false },
  grenade: { canReload: true,  reloadTime: PHYSICS.GRENADE_RELOAD_TIME,           magSize: 3,                         perShell: false },
  plasma:  { canReload: true,  reloadTime: PHYSICS.PLASMA_RELOAD_TIME,            magSize: 100,                       perShell: false },
  knife:   { canReload: false, reloadTime: 0,                                     magSize: Infinity,                  perShell: false },
} as const;

/** Per-weapon recoil patterns. */
export const RECOIL_PATTERNS: Record<WeaponType, RecoilPattern> = {
  assault: { pitchPerShot: 0.012, yawPerShot: 0.005, accumulation: 0.15, baseSpread: 0.03 },
  sniper:  { pitchPerShot: 0.087, yawPerShot: 0.01,  accumulation: 0,    baseSpread: 0 },      // ~5° single kick
  shotgun: { pitchPerShot: 0.035, yawPerShot: 0.025, accumulation: 0,    baseSpread: 0.1 },     // ~2° random
  rocket:  { pitchPerShot: 0.005, yawPerShot: 0.003, accumulation: 0,    baseSpread: 0 },       // minimal
  grenade: { pitchPerShot: 0.005, yawPerShot: 0.003, accumulation: 0,    baseSpread: 0 },
  plasma:  { pitchPerShot: 0.002, yawPerShot: 0.001, accumulation: 0.05, baseSpread: 0.02 },
  knife:   { pitchPerShot: 0,     yawPerShot: 0,     accumulation: 0,    baseSpread: 0 },
} as const;

/** System-wide recoil configuration derived from PHYSICS constants. */
export const RECOIL_CONFIG: RecoilConfig = {
  recoverySpeed: PHYSICS.RECOIL_RECOVERY_SPEED,
  recoveryDelay: PHYSICS.RECOIL_RECOVERY_DELAY,
  bloomDecaySpeed: PHYSICS.BLOOM_DECAY_SPEED,
  adsRecoilMult: PHYSICS.ADS_RECOIL_MULT,
  proneRecoilMult: PHYSICS.PRONE_RECOIL_MULT,
  movingSpreadMult: PHYSICS.MOVING_SPREAD_MULT,
  airSpreadMult: PHYSICS.AIR_SPREAD_MULT,
  crouchSpreadMult: PHYSICS.CROUCH_SPREAD_MULT,
} as const;
