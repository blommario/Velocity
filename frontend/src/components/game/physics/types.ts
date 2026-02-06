import type { Vector3 } from 'three';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
}

export interface MovementState {
  velocity: Vector3;
  isGrounded: boolean;
  yaw: number;
  pitch: number;
  jumpBufferTime: number;
}
