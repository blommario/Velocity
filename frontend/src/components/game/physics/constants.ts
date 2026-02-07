export const PHYSICS = {
  TICK_RATE: 128,
  TICK_DELTA: 1 / 128,

  // Movement — tuned for snappy feel (higher accel than Quake defaults)
  GROUND_ACCEL: 15,
  GROUND_DECEL: 10,
  GROUND_MAX_SPEED: 320,
  AIR_ACCEL: 12,
  AIR_SPEED_CAP: 30,
  GROUND_FRICTION: 6.0,
  STOP_SPEED: 100,
  MAX_SPEED: 2500,
  MAX_DISPLACEMENT_PER_STEP: 2,

  // Jumping — peak height = v²/(2g) → 150²/1600 ≈ 14 units
  JUMP_FORCE: 150,
  JUMP_FORCE_MIN: 80,             // tap-jump minimum
  JUMP_BUFFER_MS: 80,             // pre-land buffer
  JUMP_RELEASE_WINDOW_MS: 100,    // ms after jump where releasing cuts velocity
  COYOTE_TIME_MS: 100,            // grace period to jump after leaving ground

  // Gravity — 800 u/s² gives snappy Quake-like falls at meter scale
  GRAVITY: 800,
  GRAVITY_JUMP_RELEASE: 1400,     // extra gravity when jump released early (snappy descent)

  // Player capsule
  PLAYER_RADIUS: 0.4,
  PLAYER_HEIGHT: 1.8,
  PLAYER_HEIGHT_CROUCH: 1.0,
  PLAYER_EYE_OFFSET: 0.75,
  PLAYER_EYE_OFFSET_CROUCH: 0.2,

  // Crouch sliding
  CROUCH_FRICTION: 1.2,
  CROUCH_SLIDE_MIN_SPEED: 150,
  CROUCH_SLIDE_BOOST: 60,

  // Collision
  STAIR_STEP_HEIGHT: 0.45,
  MAX_SLOPE_ANGLE: 45,
  SKIN_WIDTH: 0.05,             // character controller offset (tunneling protection)

  // Mouse
  DEFAULT_SENSITIVITY: 0.002,

  // ── Rocket launcher ──
  ROCKET_SPEED: 900,
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

  // ── Wall running ──
  WALL_RUN_MIN_SPEED: 200,
  WALL_RUN_MAX_DURATION: 1.5,
  WALL_RUN_SPEED_PRESERVATION: 0.9,
  WALL_RUN_GRAVITY_MULT: 0.15,
  WALL_RUN_JUMP_FORCE_NORMAL: 250,   // away from wall
  WALL_RUN_JUMP_FORCE_UP: 200,
  WALL_RUN_DETECTION_DIST: 0.8,
  WALL_RUN_MIN_HEIGHT: 1.0,

  // ── Surfing ──
  SURF_MIN_ANGLE: 30,
  SURF_MAX_ANGLE: 60,
  SURF_FRICTION: 0,

  // ── Boost pads ──
  BOOST_PAD_DEFAULT_SPEED: 400,

  // ── Launch pads ──
  LAUNCH_PAD_DEFAULT_SPEED: 600,

  // ── Speed gates ──
  SPEED_GATE_MULTIPLIER: 1.5,
  SPEED_GATE_MIN_SPEED: 400,

  // ── Grappling hook ──
  GRAPPLE_SPEED: 1200,
  GRAPPLE_MAX_DISTANCE: 80,
  GRAPPLE_PULL_FORCE: 1500,
  GRAPPLE_SWING_GRAVITY: 600,
  GRAPPLE_RELEASE_BOOST: 1.15,
} as const;

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
