/** Engine-level physics constants — reusable across games. */
export const ENGINE_PHYSICS = {
  TICK_RATE: 128,
  TICK_DELTA: 1 / 128,

  // Movement — balanced for readable speed + strafe-jump growth
  GROUND_ACCEL: 7,
  GROUND_DECEL: 6,
  GROUND_MAX_SPEED: 140,
  AIR_ACCEL: 5,
  AIR_SPEED_CAP: 24,
  GROUND_FRICTION: 6.0,
  STOP_SPEED: 80,
  MAX_SPEED: 1200,
  MAX_DISPLACEMENT_PER_STEP: 2,

  // Jumping — peak height = v²/(2g) → 120²/1000 ≈ 14.4 units (similar height, floatier arc)
  JUMP_FORCE: 120,
  JUMP_FORCE_MIN: 60,             // tap-jump minimum
  JUMP_BUFFER_MS: 80,             // pre-land buffer
  JUMP_RELEASE_WINDOW_MS: 100,    // ms after jump where releasing cuts velocity
  COYOTE_TIME_MS: 100,            // grace period to jump after leaving ground

  // Gravity — 500 u/s² gives floatier jumps with good air control
  GRAVITY: 500,
  GRAVITY_JUMP_RELEASE: 900,      // extra gravity when jump released early

  // Player capsule
  PLAYER_RADIUS: 0.4,
  PLAYER_HEIGHT: 1.8,
  PLAYER_HEIGHT_CROUCH: 1.0,
  PLAYER_EYE_OFFSET: 0.75,
  PLAYER_EYE_OFFSET_CROUCH: 0.2,

  // Crouch sliding
  CROUCH_FRICTION: 1.2,
  CROUCH_SLIDE_MIN_SPEED: 100,
  CROUCH_SLIDE_BOOST: 40,

  // Collision
  STAIR_STEP_HEIGHT: 0.45,
  MAX_SLOPE_ANGLE: 45,
  SKIN_WIDTH: 0.08,             // character controller offset (tunneling protection)
  SNAP_TO_GROUND_DIST: 0.1,    // max distance to snap player to ground (low = less floor tunneling)

  // Mouse
  DEFAULT_SENSITIVITY: 0.002,

  // Wall running
  WALL_RUN_MIN_SPEED: 130,
  WALL_RUN_MAX_DURATION: 1.5,
  WALL_RUN_SPEED_PRESERVATION: 0.9,
  WALL_RUN_GRAVITY_MULT: 0.15,
  WALL_RUN_JUMP_FORCE_NORMAL: 180,
  WALL_RUN_JUMP_FORCE_UP: 150,
  WALL_RUN_DETECTION_DIST: 0.8,
  WALL_RUN_MIN_HEIGHT: 1.0,

  // Slope physics (walkable surfaces 0-45°)
  SLOPE_GRAVITY_SCALE: 1.0,             // how strongly gravity projects along slope (1.0 = full Quake)
  SLOPE_GROUND_NORMAL_THRESHOLD: 0.7,   // min normal.y to count as ground (~45°)
  SLOPE_MIN_ANGLE_DEG: 2,               // below this = flat, no slope effect

  // Surfing
  SURF_MIN_ANGLE: 30,
  SURF_MAX_ANGLE: 60,
  SURF_FRICTION: 0,

  // Boost pads
  BOOST_PAD_DEFAULT_SPEED: 280,

  // Launch pads
  LAUNCH_PAD_DEFAULT_SPEED: 400,

  // Speed gates
  SPEED_GATE_MULTIPLIER: 1.4,
  SPEED_GATE_MIN_SPEED: 250,

  // Grappling hook
  GRAPPLE_SPEED: 800,
  GRAPPLE_MAX_DISTANCE: 80,
  GRAPPLE_PULL_FORCE: 900,
  GRAPPLE_SWING_GRAVITY: 400,
  GRAPPLE_RELEASE_BOOST: 1.12,
} as const;

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
