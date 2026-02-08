/**
 * Shared input utilities for both FPS and RTS input handlers.
 */

/**
 * Normalizes wheel deltaY across browsers (deltaMode: pixel/line/page).
 * Returns an approximate pixel value.
 */
export function getNormalizedWheelDelta(e: WheelEvent): number {
  // deltaMode 0 = pixels, 1 = lines (~40px), 2 = pages (~800px)
  if (e.deltaMode === 1) return e.deltaY * 40;
  if (e.deltaMode === 2) return e.deltaY * 800;
  return e.deltaY;
}
