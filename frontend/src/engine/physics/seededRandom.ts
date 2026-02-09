/**
 * Seeded PRNG — Mulberry32 (fast, deterministic, 32-bit state).
 *
 * Used in physics tick for weapon spread so replays stay deterministic.
 * Call `seedRandom(seed)` at run start, then use `nextRandom()` in the
 * physics loop instead of `Math.random()`.
 *
 * Engine module — no game store imports.
 */

let _state = 0;

/** Seed the PRNG. Call once at run start with a deterministic value. */
export function seedRandom(seed: number): void {
  _state = seed | 0;
}

/**
 * Return next pseudo-random float in [0, 1).
 * Deterministic given the same seed + call sequence.
 */
export function nextRandom(): number {
  _state = (_state + 0x6D2B79F5) | 0;
  let t = Math.imul(_state ^ (_state >>> 15), 1 | _state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
