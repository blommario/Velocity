/**
 * CPU-side explosion particle simulation — pre-computed random tables,
 * spawn initialization, and per-frame update with gravity/drag. Operates
 * on flat Float32Arrays for zero-GC performance.
 *
 * Depends on: explosionConfig
 * Used by: ExplosionEffect (useFrame)
 */
import { Color } from 'three';
import { EXPLOSION, TOTAL_PARTICLES, type ParticleArrays, type SlotState, type ExplosionRequest } from './explosionConfig';

// Reusable Color for hex parsing
const _tempColor = new Color();

// Pre-computed random tables (deterministic, built once)
let _randomDirs: Float32Array | null = null;
let _randomSpeeds: Float32Array | null = null;
let _randomLifeMults: Float32Array | null = null;

function fract(x: number): number {
  return x - Math.floor(x);
}

export function ensureRandomTables() {
  if (_randomDirs) return;
  const count = EXPLOSION.PARTICLE_COUNT;
  _randomDirs = new Float32Array(count * 3);
  _randomSpeeds = new Float32Array(count);
  _randomLifeMults = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const seed = i * 0.789;
    const rx = fract(Math.sin(seed * 127.1) * 43758.5453) * 2 - 1;
    const ry = fract(Math.sin((seed + 1) * 127.1) * 43758.5453) * 2 - 1;
    const rz = fract(Math.sin((seed + 2) * 127.1) * 43758.5453) * 2 - 1;
    const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 0.01;
    _randomDirs[i * 3] = rx / len;
    _randomDirs[i * 3 + 1] = ry / len;
    _randomDirs[i * 3 + 2] = rz / len;
    _randomSpeeds[i] = fract(Math.sin((seed + 3) * 127.1) * 43758.5453) * 0.7 + 0.3;
    _randomLifeMults[i] = fract(Math.sin((seed + 6) * 127.1) * 43758.5453) * 0.5 + 0.5;
  }
}

export function createParticleArrays(): ParticleArrays {
  const p: ParticleArrays = {
    posX: new Float32Array(TOTAL_PARTICLES),
    posY: new Float32Array(TOTAL_PARTICLES),
    posZ: new Float32Array(TOTAL_PARTICLES),
    velX: new Float32Array(TOTAL_PARTICLES),
    velY: new Float32Array(TOTAL_PARTICLES),
    velZ: new Float32Array(TOTAL_PARTICLES),
    life: new Float32Array(TOTAL_PARTICLES),
    maxLife: new Float32Array(TOTAL_PARTICLES),
  };
  p.posY.fill(EXPLOSION.HIDDEN_Y);
  return p;
}

export function createSlots(): SlotState[] {
  const slots: SlotState[] = [];
  for (let i = 0; i < EXPLOSION.POOL_SIZE; i++) {
    slots.push({ active: false, needsCleanup: false, timeAlive: 0, scale: 1, colorR: 1, colorG: 0.4, colorB: 0 });
  }
  return slots;
}

/** Spawn particles into a slot for a given explosion request. */
export function spawnIntoSlot(
  slots: SlotState[],
  particles: ParticleArrays,
  gpuScale: Float32Array,
  req: ExplosionRequest,
): number {
  const count = EXPLOSION.PARTICLE_COUNT;

  // Find inactive slot, or recycle oldest
  let slotIdx = -1;
  let oldestTime = -1;
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i].active) { slotIdx = i; break; }
    if (slots[i].timeAlive > oldestTime) { oldestTime = slots[i].timeAlive; slotIdx = i; }
  }
  if (slotIdx === -1) slotIdx = 0;

  const slot = slots[slotIdx];
  _tempColor.set(req.color);

  slot.active = true;
  slot.needsCleanup = false;
  slot.timeAlive = 0;
  slot.scale = req.scale;
  slot.colorR = _tempColor.r;
  slot.colorG = _tempColor.g;
  slot.colorB = _tempColor.b;

  const base = slotIdx * count;
  const spd = EXPLOSION.SPEED * req.scale;
  const dirs = _randomDirs!;
  const speeds = _randomSpeeds!;
  const lifeMults = _randomLifeMults!;

  for (let i = 0; i < count; i++) {
    const gi = base + i;
    particles.posX[gi] = req.position[0];
    particles.posY[gi] = req.position[1];
    particles.posZ[gi] = req.position[2];
    const s = spd * speeds[i];
    particles.velX[gi] = dirs[i * 3] * s;
    particles.velY[gi] = dirs[i * 3 + 1] * s + 4;
    particles.velZ[gi] = dirs[i * 3 + 2] * s;
    const life = EXPLOSION.LIFE * lifeMults[i];
    particles.life[gi] = life;
    particles.maxLife[gi] = life;
    gpuScale[gi] = EXPLOSION.SPRITE_SIZE * req.scale;
  }

  return slotIdx;
}

/** Dirty range returned by updateSlots. */
export interface DirtyRange { min: number; max: number }

/** Update all active slots: physics, GPU buffer writes, cleanup dead. */
export function updateSlots(
  slots: SlotState[],
  particles: ParticleArrays,
  gpuPos: Float32Array,
  gpuColor: Float32Array,
  gpuScale: Float32Array,
  dt: number,
): DirtyRange {
  const count = EXPLOSION.PARTICLE_COUNT;
  const gravity = EXPLOSION.GRAVITY;
  const dragMult = 1 - dt * 2;

  let dirtyMin = TOTAL_PARTICLES;
  let dirtyMax = -1;

  for (let si = 0; si < slots.length; si++) {
    const slot = slots[si];

    if (!slot.active) {
      if (slot.needsCleanup) {
        slot.needsCleanup = false;
        const base = si * count;
        for (let i = 0; i < count; i++) gpuScale[base + i] = 0;
        if (base < dirtyMin) dirtyMin = base;
        if (base + count > dirtyMax) dirtyMax = base + count;
      }
      continue;
    }

    slot.timeAlive += dt;
    const base = si * count;

    if (slot.timeAlive > EXPLOSION.LIFE * 1.5) {
      slot.active = false;
      slot.needsCleanup = true;
      for (let i = 0; i < count; i++) gpuScale[base + i] = 0;
      if (base < dirtyMin) dirtyMin = base;
      if (base + count > dirtyMax) dirtyMax = base + count;
      continue;
    }

    if (base < dirtyMin) dirtyMin = base;
    if (base + count > dirtyMax) dirtyMax = base + count;

    const cr = slot.colorR;
    const cg = slot.colorG;
    const cb = slot.colorB;
    const spriteSize = EXPLOSION.SPRITE_SIZE * slot.scale;

    for (let i = 0; i < count; i++) {
      const gi = base + i;
      const life = particles.life[gi] - dt;
      particles.life[gi] = life;

      if (life <= 0) { if (gpuScale[gi] !== 0) gpuScale[gi] = 0; continue; }

      particles.velY[gi] -= gravity * dt;
      particles.velX[gi] *= dragMult;
      particles.velY[gi] *= dragMult;
      particles.velZ[gi] *= dragMult;

      particles.posX[gi] += particles.velX[gi] * dt;
      particles.posY[gi] += particles.velY[gi] * dt;
      particles.posZ[gi] += particles.velZ[gi] * dt;

      gpuPos[gi * 3] = particles.posX[gi];
      gpuPos[gi * 3 + 1] = particles.posY[gi];
      gpuPos[gi * 3 + 2] = particles.posZ[gi];

      const alpha = life / particles.maxLife[gi];
      gpuColor[gi * 4] = cr;
      gpuColor[gi * 4 + 1] = cg;
      gpuColor[gi * 4 + 2] = cb;
      gpuColor[gi * 4 + 3] = alpha;
      gpuScale[gi] = spriteSize * alpha;
    }
  }

  return { min: dirtyMin, max: dirtyMax };
}
