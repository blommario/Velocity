/**
 * PhysicsDice.tsx — Rapier dynamic-body dice with settling detection and
 * face-normal result reading. Engine-level: no game store imports.
 *
 * Usage:
 *   <PhysicsDice
 *     dice={[{ type: 'd20' }, { type: 'd6', color: '#ff4444' }]}
 *     position={[0, 5, 0]}
 *     onResult={(results) => console.log(results)}
 *   />
 *
 * NOTE: The Rapier world uses gravity=[0,0,0] so this component applies
 * gravity manually via addForce() each frame.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Vector3, MeshStandardMaterial, Color } from 'three';
import { getDieGeometry, type DieType, type DieGeometryData } from './diceGeometry';
import { ENGINE_PHYSICS } from '../physics/constants';
import { devLog } from '../stores/devLogStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DICE = {
  DEFAULT_SIZE: 0.7,
  /** Linear velocity threshold for "settled" (units/sec). */
  LINEAR_THRESHOLD: 0.5,
  /** Angular velocity threshold for "settled" (rad/sec). */
  ANGULAR_THRESHOLD: 0.3,
  /** Consecutive frames below threshold to confirm settled. */
  SETTLE_FRAMES: 30,
  /** Max time (seconds) before force-settling. */
  MAX_ROLL_TIME: 8.0,
  /** Default impulse magnitude. */
  DEFAULT_IMPULSE: 15.0,
  /** Default torque impulse magnitude. */
  DEFAULT_TORQUE: 8.0,
  /** Restitution (bounciness). */
  RESTITUTION: 0.3,
  /** Friction. */
  FRICTION: 0.6,
  /** Linear damping. */
  LINEAR_DAMPING: 0.3,
  /** Angular damping. */
  ANGULAR_DAMPING: 0.5,
  /** Die mass (kg). */
  MASS: 1.0,
  /** Spread radius when spawning multiple dice. */
  SPREAD: 0.8,
} as const;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface DieRollRequest {
  type: DieType;
  color?: string;
  size?: number;
  id?: string;
}

export interface DieResult {
  type: DieType;
  value: number;
  id?: string;
}

export interface PhysicsDiceProps {
  /** Dice to roll. Changing this array triggers a new roll. */
  dice: DieRollRequest[];
  /** Spawn position (center of dice cluster). */
  position: [number, number, number];
  /** Direction to throw dice (normalized). Default: [0, 0.7, 0.3]. */
  throwDirection?: [number, number, number];
  /** Impulse magnitude. Default: 15.0. */
  impulse?: number;
  /** Called when ALL dice have settled. */
  onResult: (results: DieResult[]) => void;
  /** Called per-die when it settles (optional). */
  onDieSettled?: (result: DieResult) => void;
  /** Gravity magnitude (default: ENGINE_PHYSICS.GRAVITY). */
  gravity?: number;
}

// ---------------------------------------------------------------------------
// Pre-allocated math objects (zero GC in hot path)
// ---------------------------------------------------------------------------

const _tempQuat = new Quaternion();
const _tempVec = new Vector3();

// ---------------------------------------------------------------------------
// Result reading
// ---------------------------------------------------------------------------

function readDieResult(
  rb: RapierRigidBody,
  geoData: DieGeometryData,
  isD4: boolean,
): number {
  const rot = rb.rotation();
  _tempQuat.set(rot.x, rot.y, rot.z, rot.w);

  let bestDot = isD4 ? Infinity : -Infinity;
  let bestIdx = 0;

  for (let i = 0; i < geoData.faceNormals.length; i++) {
    const [nx, ny, nz] = geoData.faceNormals[i];
    _tempVec.set(nx, ny, nz).applyQuaternion(_tempQuat);
    const dot = _tempVec.y; // dot with world-up (0,1,0)

    if (isD4) {
      // d4: bottom face → apex value
      if (dot < bestDot) {
        bestDot = dot;
        bestIdx = i;
      }
    } else {
      // All others: top face
      if (dot > bestDot) {
        bestDot = dot;
        bestIdx = i;
      }
    }
  }

  return geoData.faceValues[bestIdx];
}

// ---------------------------------------------------------------------------
// Internal per-die state
// ---------------------------------------------------------------------------

interface DieState {
  request: DieRollRequest;
  geoData: DieGeometryData;
  settled: boolean;
  settleCount: number;
  result: number | null;
  elapsed: number;
  impulseApplied: boolean;
}

// ---------------------------------------------------------------------------
// DieBody sub-component
// ---------------------------------------------------------------------------

interface DieBodyProps {
  request: DieRollRequest;
  index: number;
  spawnPos: [number, number, number];
  onRef: (index: number, rb: RapierRigidBody | null) => void;
}

function DieBody({ request, index, spawnPos, onRef }: DieBodyProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const size = request.size ?? DICE.DEFAULT_SIZE;
  const geoData = getDieGeometry(request.type, size);

  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: new Color(request.color ?? '#e8e8e8'),
      roughness: 0.4,
      metalness: 0.1,
    });
  }, [request.color]);

  useEffect(() => {
    return () => { material.dispose(); };
  }, [material]);

  useEffect(() => {
    if (rbRef.current) {
      onRef(index, rbRef.current);
    }
    return () => onRef(index, null);
  }, [index, onRef]);

  return (
    <RigidBody
      ref={rbRef}
      type="dynamic"
      position={spawnPos}
      colliders={false}
      restitution={DICE.RESTITUTION}
      friction={DICE.FRICTION}
      linearDamping={DICE.LINEAR_DAMPING}
      angularDamping={DICE.ANGULAR_DAMPING}
      mass={DICE.MASS}
    >
      <MeshCollider type="hull">
        <mesh geometry={geoData.geometry} material={material} castShadow />
      </MeshCollider>
    </RigidBody>
  );
}

// ---------------------------------------------------------------------------
// PhysicsDice — main component
// ---------------------------------------------------------------------------

export function PhysicsDice({
  dice,
  position,
  throwDirection = [0, 0.7, 0.3],
  impulse = DICE.DEFAULT_IMPULSE,
  onResult,
  onDieSettled,
  gravity = ENGINE_PHYSICS.GRAVITY,
}: PhysicsDiceProps) {
  const rbRefs = useRef<(RapierRigidBody | null)[]>([]);
  const statesRef = useRef<DieState[]>([]);
  const allSettledRef = useRef(false);
  const rollIdRef = useRef(0);

  // Build state array when dice prop changes
  const rollId = useMemo(() => {
    rollIdRef.current += 1;
    allSettledRef.current = false;
    rbRefs.current = new Array(dice.length).fill(null);

    statesRef.current = dice.map((req) => ({
      request: req,
      geoData: getDieGeometry(req.type, req.size ?? DICE.DEFAULT_SIZE),
      settled: false,
      settleCount: 0,
      result: null,
      elapsed: 0,
      impulseApplied: false,
    }));

    devLog.info('Dice', `Roll started: ${dice.map(d => d.type).join(', ')}`);
    return rollIdRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dice]);

  // Compute spawn positions spread around center
  const spawnPositions = useMemo((): [number, number, number][] => {
    const count = dice.length;
    if (count === 1) return [position];
    return dice.map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const r = DICE.SPREAD;
      return [
        position[0] + Math.cos(angle) * r,
        position[1],
        position[2] + Math.sin(angle) * r,
      ] as [number, number, number];
    });
  }, [dice, position]);

  const handleRef = useCallback((index: number, rb: RapierRigidBody | null) => {
    rbRefs.current[index] = rb;
  }, []);

  // Per-frame: apply gravity, check settling, apply initial impulse
  useFrame((_, delta) => {
    if (allSettledRef.current) return;

    const states = statesRef.current;
    const rbs = rbRefs.current;
    let allDone = true;

    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      const rb = rbs[i];
      if (!rb || state.settled) continue;
      allDone = false;

      // Apply initial impulse once
      if (!state.impulseApplied) {
        const tx = (Math.random() - 0.5) * DICE.DEFAULT_TORQUE * 2;
        const ty = (Math.random() - 0.5) * DICE.DEFAULT_TORQUE * 2;
        const tz = (Math.random() - 0.5) * DICE.DEFAULT_TORQUE * 2;

        rb.applyImpulse(
          {
            x: throwDirection[0] * impulse + (Math.random() - 0.5) * 2,
            y: throwDirection[1] * impulse,
            z: throwDirection[2] * impulse + (Math.random() - 0.5) * 2,
          },
          true,
        );
        rb.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);
        state.impulseApplied = true;
        continue; // Skip settling check this frame
      }

      // Apply gravity (world gravity is zero)
      rb.addForce({ x: 0, y: -DICE.MASS * gravity, z: 0 }, true);

      state.elapsed += delta;

      // Check settling
      const lv = rb.linvel();
      const av = rb.angvel();
      const linMag = Math.sqrt(lv.x * lv.x + lv.y * lv.y + lv.z * lv.z);
      const angMag = Math.sqrt(av.x * av.x + av.y * av.y + av.z * av.z);

      const belowThreshold =
        linMag < DICE.LINEAR_THRESHOLD && angMag < DICE.ANGULAR_THRESHOLD;
      const timedOut = state.elapsed > DICE.MAX_ROLL_TIME;

      if (belowThreshold) {
        state.settleCount++;
      } else {
        state.settleCount = 0;
      }

      if (state.settleCount >= DICE.SETTLE_FRAMES || timedOut) {
        // Force stop if timed out
        if (timedOut && !belowThreshold) {
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
          devLog.warn('Dice', `Die ${i} force-settled after timeout`);
        }

        const value = readDieResult(rb, state.geoData, state.request.type === 'd4');
        state.settled = true;
        state.result = value;

        const result: DieResult = {
          type: state.request.type,
          value,
          id: state.request.id,
        };

        devLog.info('Dice', `Die ${i} (${state.request.type}) settled → ${value}`);
        onDieSettled?.(result);
      }
    }

    // Check if all settled
    if (allDone || states.every(s => s.settled)) {
      allSettledRef.current = true;
      const results: DieResult[] = states.map(s => ({
        type: s.request.type,
        value: s.result ?? 0,
        id: s.request.id,
      }));
      devLog.success('Dice', `All dice settled: [${results.map(r => `${r.type}=${r.value}`).join(', ')}]`);
      onResult(results);
    }
  });

  return (
    <group>
      {dice.map((req, i) => (
        <DieBody
          key={`${rollId}_${i}`}
          request={req}
          index={i}
          spawnPos={spawnPositions[i]}
          onRef={handleRef}
        />
      ))}
    </group>
  );
}
