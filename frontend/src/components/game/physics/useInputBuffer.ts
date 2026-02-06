import { useEffect, useRef } from 'react';
import type { InputState } from './types';

const createEmptyInput = (): InputState => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  mouseDeltaX: 0,
  mouseDeltaY: 0,
});

export function useInputBuffer() {
  const inputRef = useRef<InputState>(createEmptyInput());

  useEffect(() => {
    const input = inputRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': input.forward = true; break;
        case 'KeyS': input.backward = true; break;
        case 'KeyA': input.left = true; break;
        case 'KeyD': input.right = true; break;
        case 'Space': input.jump = true; break;
        case 'ShiftLeft':
        case 'ControlLeft': input.crouch = true; break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': input.forward = false; break;
        case 'KeyS': input.backward = false; break;
        case 'KeyA': input.left = false; break;
        case 'KeyD': input.right = false; break;
        case 'Space': input.jump = false; break;
        case 'ShiftLeft':
        case 'ControlLeft': input.crouch = false; break;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        input.mouseDeltaX += e.movementX;
        input.mouseDeltaY += e.movementY;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const consumeMouseDelta = () => {
    const dx = inputRef.current.mouseDeltaX;
    const dy = inputRef.current.mouseDeltaY;
    inputRef.current.mouseDeltaX = 0;
    inputRef.current.mouseDeltaY = 0;
    return { dx, dy };
  };

  return { inputRef, consumeMouseDelta };
}
