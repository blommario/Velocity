export const PHYSICS = {
  TICK_RATE: 128,
  TICK_DELTA: 1 / 128,

  // Movement
  GROUND_ACCEL: 10,
  GROUND_MAX_SPEED: 320,
  AIR_ACCEL: 10,
  AIR_SPEED_CAP: 30,
  GROUND_FRICTION: 6.0,
  STOP_SPEED: 100,

  // Jumping
  JUMP_FORCE: 270,
  JUMP_BUFFER_MS: 50,

  // Gravity
  GRAVITY: 800,

  // Player capsule
  PLAYER_RADIUS: 0.4,      // meters (game scale)
  PLAYER_HEIGHT: 1.8,      // standing height in meters
  PLAYER_HEIGHT_CROUCH: 1.0,
  PLAYER_EYE_OFFSET: 0.75, // from capsule center to eye level
  PLAYER_EYE_OFFSET_CROUCH: 0.2, // eye offset when crouching

  // Crouch sliding
  CROUCH_FRICTION: 1.5,        // much lower friction while sliding
  CROUCH_SLIDE_MIN_SPEED: 200, // min horizontal speed to enter slide
  CROUCH_SLIDE_BOOST: 40,      // extra burst speed on slide entry

  // Collision
  STAIR_STEP_HEIGHT: 0.45,
  MAX_SLOPE_ANGLE: 45,

  // Mouse
  DEFAULT_SENSITIVITY: 0.002,
} as const;

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
