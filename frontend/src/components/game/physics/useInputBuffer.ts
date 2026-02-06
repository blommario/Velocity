import { useEffect, useRef } from 'react';
import type { InputState } from './types';

/** Default key bindings — maps physical key codes to input actions. */
const DEFAULT_KEY_BINDINGS: Record<string, keyof Pick<InputState, 'forward' | 'backward' | 'left' | 'right' | 'jump' | 'crouch'>> = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  ShiftLeft: 'crouch',
  ControlLeft: 'crouch',
} as const;

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

    // Ref-mutation pattern: input state is mutated directly to avoid
    // React re-renders on every keypress. The physics tick reads this
    // ref at 128Hz without triggering component updates.
    const onKeyDown = (e: KeyboardEvent) => {
      const action = DEFAULT_KEY_BINDINGS[e.code];
      if (action) input[action] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const action = DEFAULT_KEY_BINDINGS[e.code];
      if (action) input[action] = false;
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
