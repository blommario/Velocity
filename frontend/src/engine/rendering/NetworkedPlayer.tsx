/**
 * Generic networked player — renders a loaded Three.js Group at an
 * interpolated network position with skeletal animation driven by speed.
 *
 * Reads directly from RemotePlayerInterpolators in useFrame (60Hz) —
 * no React re-renders needed for position updates.
 *
 * Animation blending:
 *  - idle  when speed < IDLE_THRESHOLD
 *  - walk  when IDLE_THRESHOLD ≤ speed < RUN_THRESHOLD
 *  - run   when speed ≥ RUN_THRESHOLD
 *  Cross-fades between clips via AnimationAction weights.
 *
 * Depends on: R3F, Three.js, RemotePlayerInterpolators
 * Used by: game RemotePlayers (via prop injection)
 */
import { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Euler,
  MeshStandardMaterial,
  Color,
  Mesh,
  AnimationMixer,
  AnimationAction,
  LoopRepeat,
} from 'three';
import type { AnimationClip } from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { getInterpolator } from '../networking/RemotePlayerInterpolators';

const _euler = new Euler(0, 0, 0, 'YXZ');
const _color = new Color();

/** Animation blending constants. */
const ANIM_BLEND = {
  IDLE_THRESHOLD: 0.5,
  RUN_THRESHOLD: 4.0,
  SPEED_SMOOTHING: 0.12,
  CROSSFADE_SPEED: 8.0,
} as const;

/** Animation state type for active clip selection. */
type AnimState = 'idle' | 'walk' | 'run';

export interface NetworkedPlayerProps {
  /** Remote player ID — used to look up interpolator. */
  playerId: string;
  /** Pre-loaded model Group (will be cloned internally). */
  model: Group;
  /** Animation clips from the model asset. */
  animations?: AnimationClip[];
  /** Uniform scale to apply (game layer computes from model height → player height). */
  modelScale: number;
  /** Y offset added to network position (e.g. -halfHeight when position is body center but model origin is feet). */
  yOffset?: number;
  /** Extra yaw rotation to correct model forward direction (radians). */
  modelYawOffset?: number;
  /** Callback fired with the cloned scene Group — allows game layer to attach objects (e.g. weapons) to bones. */
  onClonedScene?: (scene: Group) => void;
  /** Display color (CSS string). */
  color: string;
  /** Emissive intensity. */
  emissiveIntensity?: number;
}

/** Find a clip by partial name match (case-insensitive). */
function findClip(clips: AnimationClip[], keyword: string): AnimationClip | undefined {
  const lower = keyword.toLowerCase();
  return clips.find((c) => c.name.toLowerCase().includes(lower));
}

export function NetworkedPlayer({
  playerId,
  model,
  animations,
  modelScale,
  yOffset = 0,
  modelYawOffset = 0,
  onClonedScene,
  color,
  emissiveIntensity = 0.6,
}: NetworkedPlayerProps) {
  const groupRef = useRef<Group>(null);

  /** Per-instance mutable state for speed tracking. */
  const motionState = useRef({
    prevX: 0,
    prevZ: 0,
    hasPrev: false,
    smoothSpeed: 0,
    currentAnim: 'idle' as AnimState,
  });

  // Clone model with correct skeleton rebinding (SkeletonUtils handles bone→mesh binding)
  const clonedScene = useMemo(() => {
    return SkeletonUtils.clone(model) as Group;
  }, [model]);

  // Notify parent after render — avoids setState-during-render warning
  useLayoutEffect(() => {
    onClonedScene?.(clonedScene);
  }, [clonedScene, onClonedScene]);

  // Create AnimationMixer and actions
  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionsRef = useRef<{ idle?: AnimationAction; walk?: AnimationAction; run?: AnimationAction }>({});

  useEffect(() => {
    if (!animations || animations.length === 0) return;

    const mixer = new AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    const idleClip = findClip(animations, 'idle');
    const walkClip = findClip(animations, 'walk');
    const runClip = findClip(animations, 'run');

    const actions: typeof actionsRef.current = {};

    if (idleClip) {
      actions.idle = mixer.clipAction(idleClip);
      actions.idle.setLoop(LoopRepeat, Infinity);
      actions.idle.play();
      actions.idle.setEffectiveWeight(1);
    }
    if (walkClip) {
      actions.walk = mixer.clipAction(walkClip);
      actions.walk.setLoop(LoopRepeat, Infinity);
      actions.walk.play();
      actions.walk.setEffectiveWeight(0);
    }
    if (runClip) {
      actions.run = mixer.clipAction(runClip);
      actions.run.setLoop(LoopRepeat, Infinity);
      actions.run.play();
      actions.run.setEffectiveWeight(0);
    }

    actionsRef.current = actions;

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
      actionsRef.current = {};
    };
  }, [clonedScene, animations]);

  // Create material once
  const customMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      transparent: true,
      opacity: 0.85,
      depthWrite: true,
    });
  }, []);

  // Mutate material props when color/emissive changes — no re-clone
  useLayoutEffect(() => {
    _color.set(color);
    customMaterial.color.set(_color);
    customMaterial.emissive.set(_color);
    customMaterial.emissiveIntensity = emissiveIntensity;

    clonedScene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.material !== customMaterial) {
          mesh.material = customMaterial;
        }
      }
    });
  }, [clonedScene, customMaterial, color, emissiveIntensity]);

  // Dispose material on unmount
  useEffect(() => {
    return () => { customMaterial.dispose(); };
  }, [customMaterial]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const interp = getInterpolator(playerId);
    if (!interp) {
      if (group.visible) group.visible = false;
      return;
    }

    const sampled = interp.sample();
    if (!sampled) {
      if (group.visible) group.visible = false;
      return;
    }

    if (!group.visible) group.visible = true;

    const px = sampled.position[0];
    const pz = sampled.position[2];

    group.position.set(sampled.position[0], sampled.position[1] + yOffset, sampled.position[2]);
    _euler.set(0, sampled.yaw + Math.PI + modelYawOffset, 0);
    group.rotation.copy(_euler);

    // ── Speed tracking for animation blending ──
    const dt = Math.min(delta, 0.1);
    const ms = motionState.current;

    if (!ms.hasPrev) {
      ms.prevX = px;
      ms.prevZ = pz;
      ms.hasPrev = true;
    } else {
      const dx = px - ms.prevX;
      const dz = pz - ms.prevZ;
      ms.prevX = px;
      ms.prevZ = pz;

      const instantSpeed = dt > 0 ? Math.sqrt(dx * dx + dz * dz) / dt : 0;
      ms.smoothSpeed += (instantSpeed - ms.smoothSpeed) * ANIM_BLEND.SPEED_SMOOTHING;
    }

    // ── Animation blending ──
    const mixer = mixerRef.current;
    if (mixer) {
      mixer.update(dt);

      const speed = ms.smoothSpeed;
      const actions = actionsRef.current;

      // Determine target weights
      let idleW = 0;
      let walkW = 0;
      let runW = 0;

      if (speed < ANIM_BLEND.IDLE_THRESHOLD) {
        idleW = 1;
      } else if (speed < ANIM_BLEND.RUN_THRESHOLD) {
        const t = (speed - ANIM_BLEND.IDLE_THRESHOLD) / (ANIM_BLEND.RUN_THRESHOLD - ANIM_BLEND.IDLE_THRESHOLD);
        walkW = 1;
        // Blend walk speed to match movement
        if (actions.walk) {
          actions.walk.setEffectiveTimeScale(0.8 + t * 0.6);
        }
        idleW = 0;
      } else {
        runW = 1;
      }

      // Smooth weight transitions
      const lerpSpeed = ANIM_BLEND.CROSSFADE_SPEED * dt;
      if (actions.idle) {
        const w = actions.idle.getEffectiveWeight();
        actions.idle.setEffectiveWeight(w + (idleW - w) * lerpSpeed);
      }
      if (actions.walk) {
        const w = actions.walk.getEffectiveWeight();
        actions.walk.setEffectiveWeight(w + (walkW - w) * lerpSpeed);
      }
      if (actions.run) {
        const w = actions.run.getEffectiveWeight();
        actions.run.setEffectiveWeight(w + (runW - w) * lerpSpeed);
      }
    }
  });

  return (
    <group ref={groupRef} visible={false} scale={[modelScale, modelScale, modelScale]}>
      <primitive object={clonedScene} />
    </group>
  );
}
