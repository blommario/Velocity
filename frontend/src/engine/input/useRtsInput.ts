/**
 * RTS-style input handler — no pointer lock required.
 *
 * Tracks:
 *  - WASD for directional panning
 *  - Q/E for rotation
 *  - Scroll wheel for zoom
 *  - Middle-drag for camera panning
 *  - Right-drag for camera rotation
 *  - Edge scrolling (mouse near screen edges)
 *  - Left-click for selection
 *
 * Engine-level: may import settingsStore but no game stores.
 */
import { useEffect, useRef } from 'react';
import { getNormalizedWheelDelta } from './inputUtils';

export interface RtsInputState {
  // Keyboard pan (WASD)
  panForward: boolean;
  panBackward: boolean;
  panLeft: boolean;
  panRight: boolean;
  // Keyboard rotate (Q/E)
  rotateLeft: boolean;
  rotateRight: boolean;
  // Mouse drag
  middleDragDeltaX: number;
  middleDragDeltaY: number;
  rightDragDeltaX: number;
  rightDragDeltaY: number;
  isDraggingMiddle: boolean;
  isDraggingRight: boolean;
  // Scroll (zoom)
  scrollDelta: number;
  // Edge scroll direction (-1/0/1 per axis)
  edgeX: number;
  edgeY: number;
  // Click selection
  leftClickX: number;
  leftClickY: number;
  hasLeftClick: boolean;
}

const EDGE_THRESHOLD = 8; // pixels from screen edge
const CLICK_DRAG_THRESHOLD_SQ = 6 * 6; // px² — distinguishes click from drag

function createEmptyRtsInput(): RtsInputState {
  return {
    panForward: false,
    panBackward: false,
    panLeft: false,
    panRight: false,
    rotateLeft: false,
    rotateRight: false,
    middleDragDeltaX: 0,
    middleDragDeltaY: 0,
    rightDragDeltaX: 0,
    rightDragDeltaY: 0,
    isDraggingMiddle: false,
    isDraggingRight: false,
    scrollDelta: 0,
    edgeX: 0,
    edgeY: 0,
    leftClickX: -1,
    leftClickY: -1,
    hasLeftClick: false,
  };
}

const RTS_KEY_BINDINGS: Record<string, keyof Pick<RtsInputState,
  'panForward' | 'panBackward' | 'panLeft' | 'panRight' | 'rotateLeft' | 'rotateRight'
>> = {
  KeyW: 'panForward',
  KeyS: 'panBackward',
  KeyA: 'panLeft',
  KeyD: 'panRight',
  KeyQ: 'rotateLeft',
  KeyE: 'rotateRight',
} as const;

export function useRtsInput(edgeScrollEnabled = true) {
  const inputRef = useRef<RtsInputState>(createEmptyRtsInput());

  useEffect(() => {
    const input = inputRef.current;
    // Track mousedown position for click-vs-drag detection
    let leftDownX = -1;
    let leftDownY = -1;

    const onKeyDown = (e: KeyboardEvent) => {
      const action = RTS_KEY_BINDINGS[e.code];
      if (action) input[action] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const action = RTS_KEY_BINDINGS[e.code];
      if (action) input[action] = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) input.isDraggingMiddle = true;
      if (e.button === 2) input.isDraggingRight = true;
      if (e.button === 0) {
        leftDownX = e.clientX;
        leftDownY = e.clientY;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) input.isDraggingMiddle = false;
      if (e.button === 2) input.isDraggingRight = false;
      // Click fires on mouseup — only if mouse didn't drag far (enables future box-select)
      if (e.button === 0 && leftDownX >= 0) {
        const dx = e.clientX - leftDownX;
        const dy = e.clientY - leftDownY;
        if (dx * dx + dy * dy < CLICK_DRAG_THRESHOLD_SQ) {
          input.hasLeftClick = true;
          input.leftClickX = e.clientX;
          input.leftClickY = e.clientY;
        }
        leftDownX = -1;
        leftDownY = -1;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      // Drag deltas (accumulate for consumption)
      if (input.isDraggingMiddle) {
        input.middleDragDeltaX += e.movementX;
        input.middleDragDeltaY += e.movementY;
      }
      if (input.isDraggingRight) {
        input.rightDragDeltaX += e.movementX;
        input.rightDragDeltaY += e.movementY;
      }

      // Edge scroll detection
      if (edgeScrollEnabled) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        input.edgeX = e.clientX < EDGE_THRESHOLD ? -1 : e.clientX > w - EDGE_THRESHOLD ? 1 : 0;
        input.edgeY = e.clientY < EDGE_THRESHOLD ? -1 : e.clientY > h - EDGE_THRESHOLD ? 1 : 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      input.scrollDelta += getNormalizedWheelDelta(e);
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    // Reset edge scroll when mouse leaves window
    const onMouseLeave = () => {
      input.edgeX = 0;
      input.edgeY = 0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);
    document.documentElement.addEventListener('mouseleave', onMouseLeave);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [edgeScrollEnabled]);

  /** Consume accumulated drag deltas + scroll, reset to 0. */
  const consumeDeltas = () => {
    const out = {
      middleDragDx: inputRef.current.middleDragDeltaX,
      middleDragDy: inputRef.current.middleDragDeltaY,
      rightDragDx: inputRef.current.rightDragDeltaX,
      rightDragDy: inputRef.current.rightDragDeltaY,
      scroll: inputRef.current.scrollDelta,
    };
    inputRef.current.middleDragDeltaX = 0;
    inputRef.current.middleDragDeltaY = 0;
    inputRef.current.rightDragDeltaX = 0;
    inputRef.current.rightDragDeltaY = 0;
    inputRef.current.scrollDelta = 0;
    return out;
  };

  /** Consume left-click event (returns null if no click). */
  const consumeClick = () => {
    if (!inputRef.current.hasLeftClick) return null;
    const out = { x: inputRef.current.leftClickX, y: inputRef.current.leftClickY };
    inputRef.current.hasLeftClick = false;
    return out;
  };

  return { inputRef, consumeDeltas, consumeClick };
}
