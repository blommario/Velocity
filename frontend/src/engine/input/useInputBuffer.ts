import { useEffect, useRef } from 'react';
import type { InputState } from '../types/physics';
import { getNormalizedWheelDelta } from './inputUtils';
import { useSettingsStore } from '../stores/settingsStore';

type BooleanInputKey = keyof Pick<InputState,
  'forward' | 'backward' | 'left' | 'right' | 'jump' | 'crouch' | 'prone' | 'fire' | 'altFire' | 'grapple' | 'reload' | 'inspect' | 'weaponWheel'
>;

/** Maps settingsStore action names → engine InputState boolean field names. */
const SETTINGS_TO_INPUT: Record<string, BooleanInputKey> = {
  moveForward: 'forward',
  moveBack: 'backward',
  moveLeft: 'left',
  moveRight: 'right',
  jump: 'jump',
  crouch: 'crouch',
  prone: 'prone',
  grapple: 'grapple',
  reload: 'reload',
  fireRocket: 'fire',
  fireGrenade: 'altFire',
  inspect: 'inspect',
  weaponWheel: 'weaponWheel',
} as const;

const BOOLEAN_KEYS: readonly BooleanInputKey[] = [
  'forward', 'backward', 'left', 'right', 'jump', 'crouch', 'prone', 'fire', 'altFire', 'grapple', 'reload', 'inspect', 'weaponWheel',
] as const;

/** Maps Digit keys to weapon slots (1-7) */
const WEAPON_SLOT_KEYS: Record<string, number> = {
  Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4,
  Digit5: 5, Digit6: 6, Digit7: 7,
} as const;

/** Invert action→key bindings to key→InputState, skipping Mouse* entries. */
function buildKeyMap(bindings: Record<string, string>): Record<string, BooleanInputKey> {
  const map: Record<string, BooleanInputKey> = {};
  for (const [action, key] of Object.entries(bindings)) {
    if (key.startsWith('Mouse')) continue;
    const inputAction = SETTINGS_TO_INPUT[action];
    if (inputAction) map[key] = inputAction;
  }
  return map;
}

/** Extract Mouse{N} bindings to button-number→InputState map. */
function buildMouseMap(bindings: Record<string, string>): Record<number, BooleanInputKey> {
  const map: Record<number, BooleanInputKey> = {};
  for (const [action, key] of Object.entries(bindings)) {
    if (!key.startsWith('Mouse')) continue;
    const inputAction = SETTINGS_TO_INPUT[action];
    if (!inputAction) continue;
    const button = parseInt(key.slice(5), 10);
    if (!isNaN(button)) map[button] = inputAction;
  }
  return map;
}

const createEmptyInput = (): InputState => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  prone: false,
  fire: false,
  altFire: false,
  grapple: false,
  reload: false,
  inspect: false,
  weaponWheel: false,
  mouseDeltaX: 0,
  mouseDeltaY: 0,
  weaponSlot: 0,
  scrollDelta: 0,
});

interface InputMappings {
  keyMap: Record<string, BooleanInputKey>;
  mouseMap: Record<number, BooleanInputKey>;
}

export function useInputBuffer() {
  const inputRef = useRef<InputState>(createEmptyInput());
  const mappingsRef = useRef<InputMappings>({
    keyMap: buildKeyMap(useSettingsStore.getState().keyBindings),
    mouseMap: buildMouseMap(useSettingsStore.getState().keyBindings),
  });

  useEffect(() => {
    const input = inputRef.current;

    // Subscribe to keybind changes — rebuild maps reactively
    let prevBindings = useSettingsStore.getState().keyBindings;
    const unsub = useSettingsStore.subscribe((state) => {
      if (state.keyBindings !== prevBindings) {
        prevBindings = state.keyBindings;
        mappingsRef.current = {
          keyMap: buildKeyMap(state.keyBindings),
          mouseMap: buildMouseMap(state.keyBindings),
        };
        // Reset all held actions to prevent stuck keys after rebind
        for (const k of BOOLEAN_KEYS) input[k] = false;
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const action = mappingsRef.current.keyMap[e.code];
      if (action) input[action] = true;

      // Weapon slot keys (consumed once per press)
      const slot = WEAPON_SLOT_KEYS[e.code];
      if (slot !== undefined) input.weaponSlot = slot;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const action = mappingsRef.current.keyMap[e.code];
      if (action) input[action] = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const action = mappingsRef.current.mouseMap[e.button];
      if (action) input[action] = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      const action = mappingsRef.current.mouseMap[e.button];
      if (action) input[action] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        input.mouseDeltaX += e.movementX;
        input.mouseDeltaY += e.movementY;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement) {
        e.preventDefault();
        input.scrollDelta += getNormalizedWheelDelta(e);
      }
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel);
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      unsub();
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
