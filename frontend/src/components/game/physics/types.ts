import type { Vector3 } from 'three';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  fire: boolean;
  altFire: boolean;   // grenade
  grapple: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
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

export type WeaponType = 'rocket' | 'grenade';
