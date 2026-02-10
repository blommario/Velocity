/**
 * GPU particle compute node builder — creates TSL init + update compute
 * shaders for point-emitter particles with randomised velocity and respawning.
 *
 * Depends on: three/tsl (Fn, instanceIndex, instancedArray, hash, etc.)
 * Used by: GpuParticles
 */
import {
  Fn, instanceIndex, instancedArray, float, vec3,
  hash, uniform, deltaTime,
} from 'three/tsl';

const PARTICLES = {
  MIN_LIFE: 0.3,
  MAX_LIFE: 1.5,
} as const;

export function createComputeNodes(
  count: number,
  emitterPos: [number, number, number],
  _color: string,
  spread: number,
  speed: number,
  dir: [number, number, number],
) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  const lifeBuffer = instancedArray(count, 'float');

  const emitterPosition = uniform(vec3(emitterPos[0], emitterPos[1], emitterPos[2]));
  const emitterDirection = uniform(vec3(dir[0], dir[1], dir[2]));
  const particleSpeed = uniform(float(speed));
  const particleSpread = uniform(float(spread));

  const colorNode = vec3(
    float(parseInt(_color.slice(1, 3), 16) / 255),
    float(parseInt(_color.slice(3, 5), 16) / 255),
    float(parseInt(_color.slice(5, 7), 16) / 255),
  );

  const computeInit = Fn(() => {
    const idx = instanceIndex;
    const seed = idx.toFloat().mul(0.123);

    const rx = hash(seed).sub(0.5).mul(particleSpread);
    const ry = hash(seed.add(1.0)).sub(0.5).mul(particleSpread);
    const rz = hash(seed.add(2.0)).sub(0.5).mul(particleSpread);

    positionBuffer.element(idx).assign(emitterPosition.add(vec3(rx, ry, rz)));

    const vx = emitterDirection.x.add(hash(seed.add(3.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    const vy = emitterDirection.y.add(hash(seed.add(4.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    const vz = emitterDirection.z.add(hash(seed.add(5.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    velocityBuffer.element(idx).assign(vec3(vx, vy, vz));

    lifeBuffer.element(idx).assign(
      hash(seed.add(6.0)).mul(PARTICLES.MAX_LIFE - PARTICLES.MIN_LIFE).add(PARTICLES.MIN_LIFE),
    );
  })().compute(count);

  const computeUpdate = Fn(() => {
    const idx = instanceIndex;
    const pos = positionBuffer.element(idx).toVar();
    const vel = velocityBuffer.element(idx).toVar();
    const life = lifeBuffer.element(idx).toVar();

    life.subAssign(deltaTime);

    const seed = idx.toFloat().mul(0.456).add(life);
    const shouldRespawn = life.lessThan(0.0);

    const newX = emitterPosition.x.add(hash(seed).sub(0.5).mul(particleSpread));
    const newY = emitterPosition.y.add(hash(seed.add(1.0)).sub(0.5).mul(particleSpread));
    const newZ = emitterPosition.z.add(hash(seed.add(2.0)).sub(0.5).mul(particleSpread));

    pos.assign(shouldRespawn.select(vec3(newX, newY, newZ), pos.add(vel.mul(deltaTime))));

    const nvx = emitterDirection.x.add(hash(seed.add(3.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    const nvy = emitterDirection.y.add(hash(seed.add(4.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    const nvz = emitterDirection.z.add(hash(seed.add(5.0)).sub(0.5).mul(0.5)).mul(particleSpeed);

    vel.assign(shouldRespawn.select(vec3(nvx, nvy, nvz), vel));

    const newLife = hash(seed.add(6.0)).mul(PARTICLES.MAX_LIFE - PARTICLES.MIN_LIFE).add(PARTICLES.MIN_LIFE);
    life.assign(shouldRespawn.select(newLife, life));

    positionBuffer.element(idx).assign(pos);
    velocityBuffer.element(idx).assign(vel);
    lifeBuffer.element(idx).assign(life);
  })().compute(count);

  return { positionBuffer, velocityBuffer, lifeBuffer, colorNode, computeInit, computeUpdate };
}
