import { ENGINE_PHYSICS, DEG2RAD as _DEG2RAD, RAD2DEG as _RAD2DEG } from '../../../engine/physics/constants';

/** Full physics constants = engine core + Velocity-specific game balance. */
export const PHYSICS = {
  ...ENGINE_PHYSICS,

  // ── Rocket launcher ──
  ROCKET_SPEED: 350,
  ROCKET_RADIUS: 0.15,
  ROCKET_EXPLOSION_RADIUS: 12,  // was 150 — scaled to match game units
  ROCKET_KNOCKBACK_FORCE: 800,  // was 1200 — tuned for gameplay balance
  ROCKET_SELF_DAMAGE_MULT: 0.5,
  ROCKET_DAMAGE: 100,
  ROCKET_FIRE_COOLDOWN: 0.8, // seconds

  // ── Grenades ──
  GRENADE_SPEED: 600,
  GRENADE_RADIUS: 0.12,
  GRENADE_FUSE_TIME: 2.5,
  GRENADE_BOUNCE_DAMPING: 0.6,
  GRENADE_EXPLOSION_RADIUS: 10, // was 120 — scaled to match game units
  GRENADE_KNOCKBACK_FORCE: 650, // was 1000 — tuned for gameplay balance
  GRENADE_DAMAGE: 80,
  GRENADE_FIRE_COOLDOWN: 0.6,

  // ── Health ──
  HEALTH_MAX: 100,
  HEALTH_REGEN_DELAY: 3.0,  // seconds after last damage
  HEALTH_REGEN_RATE: 15,    // hp/s

  // ── Sniper rifle (hitscan) ──
  SNIPER_DAMAGE: 200,
  SNIPER_RANGE: 500,
  SNIPER_KNOCKBACK: 80,         // small self-knockback backward
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
  SHOTGUN_KNOCKBACK: 60,        // moderate push
  SHOTGUN_SELF_KNOCKBACK: 40,   // small self-boost
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
  PLASMA_PUSHBACK: 200,         // push force on self (mini-boost)
  PLASMA_AMMO_PER_SEC: 10,
  PLASMA_MAX_AMMO: 100,

  // ── Weapon switching ──
  WEAPON_SWAP_TIME: 0.3,        // seconds to switch weapons
} as const;

export { _DEG2RAD as DEG2RAD, _RAD2DEG as RAD2DEG };
