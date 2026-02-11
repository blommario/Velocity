/**
 * Free-fly camera controller for the map editor.
 * WASD movement, right-click drag look, Shift for speed boost.
 *
 * Depends on: react, @react-three/fiber, three
 * Used by: EditorViewport
 */
import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Euler, MathUtils } from 'three';

const FLY_SPEED = 40;
const FLY_SPEED_FAST = 120;
const MOUSE_SENSITIVITY = 0.002;

const _euler = new Euler(0, 0, 0, 'YXZ');
const _forward = new Vector3();
const _right = new Vector3();

/**
 * Free-fly camera for the map editor.
 * WASD to move, right-click drag to look.
 * Shift = fast, Space = up, Q = down.
 */
export function EditorCamera() {
  const { camera, gl } = useThree();
  const keys = useRef<Set<string>>(new Set());
  const isPointerDown = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      keys.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2) {
        isPointerDown.current = true;
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        isPointerDown.current = false;
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown.current) return;
      _euler.setFromQuaternion(camera.quaternion, 'YXZ');
      _euler.y -= e.movementX * MOUSE_SENSITIVITY;
      _euler.x -= e.movementY * MOUSE_SENSITIVITY;
      _euler.x = MathUtils.clamp(_euler.x, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
      camera.quaternion.setFromEuler(_euler);
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const k = keys.current;
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? FLY_SPEED_FAST : FLY_SPEED;

    let dx = 0, dy = 0, dz = 0;

    if (k.has('KeyW')) dz -= 1;
    if (k.has('KeyS')) dz += 1;
    if (k.has('KeyA')) dx -= 1;
    if (k.has('KeyD')) dx += 1;
    if (k.has('Space')) dy += 1;
    if (k.has('KeyQ')) dy -= 1;

    if (dx !== 0 || dy !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx /= len; dy /= len; dz /= len;

      _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion);

      camera.position.addScaledVector(_forward, -dz * speed * delta);
      camera.position.addScaledVector(_right, dx * speed * delta);
      camera.position.y += dy * speed * delta;
    }
  });

  return null;
}
