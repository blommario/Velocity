import { useEffect, useRef } from 'react';
import type { InputState } from './types';

type BooleanInputKey = keyof Pick<InputState,
  'forward' | 'backward' | 'left' | 'right' | 'jump' | 'crouch' | 'fire' | 'altFire' | 'grapple'
>;

/** Default key bindings — maps physical key codes to input actions. */
const DEFAULT_KEY_BINDINGS: Record<string, BooleanInputKey> = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  ShiftLeft: 'crouch',
  ControlLeft: 'crouch',
  KeyE: 'grapple',
  KeyG: 'altFire',
} as const;

const createEmptyInput = (): InputState => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  fire: false,
  altFire: false,
  grapple: false,
  mouseDeltaX: 0,
  mouseDeltaY: 0,
});

export function useInputBuffer() {
  const inputRef = useRef<InputState>(createEmptyInput());

  useEffect(() => {
    const input = inputRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      const action = DEFAULT_KEY_BINDINGS[e.code];
      if (action) input[action] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const action = DEFAULT_KEY_BINDINGS[e.code];
      if (action) input[action] = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      if (e.button === 0) input.fire = true;
      if (e.button === 2) input.altFire = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) input.fire = false;
      if (e.button === 2) input.altFire = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        input.mouseDeltaX += e.movementX;
        input.mouseDeltaY += e.movementY;
      }
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('contextmenu', onContextMenu);
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
