export { ENGINE_PHYSICS, DEG2RAD, RAD2DEG } from './constants';
export {
  applyFriction,
  applySlideFriction,
  applyGroundAcceleration,
  applyAirAcceleration,
  getWishDir,
  getHorizontalSpeed,
} from './useMovement';
export {
  applyGrappleSwing,
  applyExplosionKnockback,
  applyBoostPad,
  applyLaunchPad,
  applySpeedGate,
  updateWallRun,
  wallJump,
  createWallRunState,
  isSurfSurface,
  applySurfPhysics,
  type WallRunState,
} from './useAdvancedMovement';
