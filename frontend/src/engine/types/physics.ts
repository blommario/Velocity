import type { Vector3 } from 'three';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  fire: boolean;
  altFire: boolean;   // right click (zoom for sniper, alt-fire for others)
  grapple: boolean;
  reload: boolean;
  inspect: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
  weaponSlot: number;     // 0 = no switch, 1-7 = switch to slot
  scrollDelta: number;    // accumulated scroll wheel delta
}

export interface MovementState {
  velocity: Vector3;
  isGrounded: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  yaw: number;
  pitch: number;
  jumpBufferTime: number;
}
