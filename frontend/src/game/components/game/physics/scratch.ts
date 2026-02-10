import { Vector3 } from 'three';
import { Ray } from '@dimforge/rapier3d-compat';

/** Pre-allocated scratch objects shared across tick sub-functions (zero GC). */
export const _desiredTranslation = new Vector3();
export const _correctedMovement = new Vector3();
export const _newPos = new Vector3();
export const _playerPos = new Vector3();
export const _fireDir = new Vector3();
export const _reusableRay = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
export const _mantleRay = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
export const _hitPos: [number, number, number] = [0, 0, 0];
export const _gPos: [number, number, number] = [0, 0, 0];
