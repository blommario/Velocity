import { useEffect, useRef } from 'react';
import type { InputState } from './types';

type BooleanInputKey = keyof Pick<InputState,
  'forward' | 'backward' | 'left' | 'right' | 'jump' | 'crouch' | 'fire' | 'altFire' | 'grapple' | 'reload'
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
  KeyR: 'reload',
} as const;

/** Maps Digit keys to weapon slots (1-7) */
const WEAPON_SLOT_KEYS: Record<string, number> = {
  Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4,
  Digit5: 5, Digit6: 6, Digit7: 7,
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
  reload: false,
  mouseDeltaX: 0,
  mouseDeltaY: 0,
  weaponSlot: 0,
  scrollDelta: 0,
});

export function useInputBuffer() {
  const inputRef = useRef<InputState>(createEmptyInput());

  useEffect(() => {
    const input = inputRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      const action = DEFAULT_KEY_BINDINGS[e.code];
      if (action) input[action] = true;

      // Weapon slot keys (consumed once per press)
      const slot = WEAPON_SLOT_KEYS[e.code];
      if (slot !== undefined) input.weaponSlot = slot;
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

    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement) {
        input.scrollDelta += e.deltaY;
      }
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
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
