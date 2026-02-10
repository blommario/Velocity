/**
 * tslNoise.ts — Reusable TSL noise functions for procedural materials.
 *
 * All functions use world-space input (no UV dependency).
 * Engine-level: no game store imports.
 */

import { Fn, float, vec2, vec3, hash, floor, fract, mix } from 'three/tsl';
// ShaderNodeObject, Node not exported from three/tsl — use any

/** 2D value noise with smoothstep interpolation. Input: vec2, output: float [0,1]. */
export const valueNoise2D = Fn(([p_immutable]: [any]) => {
  const p = vec2(p_immutable);
  const i = floor(p);
  const f = fract(p);
  // Cubic Hermite for smooth interpolation
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

  const a = hash(i);
  const b = hash(i.add(vec2(1, 0)));
  const c = hash(i.add(vec2(0, 1)));
  const d = hash(i.add(vec2(1, 1)));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});

/** 3D value noise. Input: vec3, output: float [0,1]. */
export const valueNoise3D = Fn(([p_immutable]: [any]) => {
  const p = vec3(p_immutable);
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

  // 8-corner hash
  const n000 = hash(i);
  const n100 = hash(i.add(vec3(1, 0, 0)));
  const n010 = hash(i.add(vec3(0, 1, 0)));
  const n110 = hash(i.add(vec3(1, 1, 0)));
  const n001 = hash(i.add(vec3(0, 0, 1)));
  const n101 = hash(i.add(vec3(1, 0, 1)));
  const n011 = hash(i.add(vec3(0, 1, 1)));
  const n111 = hash(i.add(vec3(1, 1, 1)));

  const x0 = mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y);
  const x1 = mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y);
  return mix(x0, x1, u.z);
});

/** Fractal Brownian Motion (2D). Octaves fixed at 3 for performance. */
export const fbm2D = Fn(([p_immutable]: [any]) => {
  const p = vec2(p_immutable);
  let value = valueNoise2D(p).mul(0.5);
  value = value.add(valueNoise2D(p.mul(2.0)).mul(0.25));
  value = value.add(valueNoise2D(p.mul(4.0)).mul(0.125));
  return value;
});
