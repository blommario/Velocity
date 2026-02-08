/** Engine-level physics constants — reusable across games. */
export const ENGINE_PHYSICS = {
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
  SKIN_WIDTH: 0.08,             // character controller offset (tunneling protection)
  SNAP_TO_GROUND_DIST: 0.1,    // max distance to snap player to ground (low = less floor tunneling)

  // Mouse
  DEFAULT_SENSITIVITY: 0.002,

  // Wall running
  WALL_RUN_MIN_SPEED: 200,
  WALL_RUN_MAX_DURATION: 1.5,
  WALL_RUN_SPEED_PRESERVATION: 0.9,
  WALL_RUN_GRAVITY_MULT: 0.15,
  WALL_RUN_JUMP_FORCE_NORMAL: 250,
  WALL_RUN_JUMP_FORCE_UP: 200,
  WALL_RUN_DETECTION_DIST: 0.8,
  WALL_RUN_MIN_HEIGHT: 1.0,

  // Surfing
  SURF_MIN_ANGLE: 30,
  SURF_MAX_ANGLE: 60,
  SURF_FRICTION: 0,

  // Boost pads
  BOOST_PAD_DEFAULT_SPEED: 400,

  // Launch pads
  LAUNCH_PAD_DEFAULT_SPEED: 600,

  // Speed gates
  SPEED_GATE_MULTIPLIER: 1.5,
  SPEED_GATE_MIN_SPEED: 400,

  // Grappling hook
  GRAPPLE_SPEED: 1200,
  GRAPPLE_MAX_DISTANCE: 80,
  GRAPPLE_PULL_FORCE: 1500,
  GRAPPLE_SWING_GRAVITY: 600,
  GRAPPLE_RELEASE_BOOST: 1.15,
} as const;

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
