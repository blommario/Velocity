import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AnimationMixer,
  LoopRepeat,
  LoopOnce,
  LoopPingPong,
} from 'three/webgpu';
import type { AnimationClip, AnimationAction, Group } from 'three/webgpu';
import { devLog } from '../stores/devLogStore';

// ── Types ──

export type AnimationLoopMode = 'repeat' | 'once' | 'pingpong';

const LOOP_MAP = {
  repeat: LoopRepeat,
  once: LoopOnce,
  pingpong: LoopPingPong,
} as const;

export interface PlayOptions {
  loop?: AnimationLoopMode;
  /** Playback speed multiplier. Default: 1.0 */
  speed?: number;
  /** Clamp at last frame when loop='once'. Default: true */
  clampWhenFinished?: boolean;
}

export interface UseAnimationProps {
  /** Root Group of the model (the cloned scene). */
  root: Group | null;
  /** AnimationClip array from loadModelWithAnimations. */
  clips: AnimationClip[];
  /** Called when a LoopOnce action finishes. */
  onComplete?: (clipName: string) => void;
}

export interface UseAnimationResult {
  /** Play a clip by name. Returns the AnimationAction or null if not found. */
  play: (name: string, options?: PlayOptions) => AnimationAction | null;
  /** Stop all playing actions. */
  stop: () => void;
  /** Cross-fade from one clip to another over duration seconds. */
  crossFade: (fromName: string, toName: string, duration: number, options?: PlayOptions) => void;
  /** The underlying AnimationMixer (for advanced use). */
  mixer: AnimationMixer | null;
  /** Names of all available animation clips. */
  clipNames: string[];
}

// ── Hook ──

export function useAnimation({
  root,
  clips,
  onComplete,
}: UseAnimationProps): UseAnimationResult {
  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, AnimationAction>>(new Map());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clipNames = useMemo(() => clips.map((c) => c.name), [clips]);

  // Create mixer and cache actions
  useEffect(() => {
    if (!root || clips.length === 0) {
      mixerRef.current = null;
      actionsRef.current.clear();
      return;
    }

    const mixer = new AnimationMixer(root);
    mixerRef.current = mixer;

    const actions = new Map<string, AnimationAction>();
    for (const clip of clips) {
      actions.set(clip.name, mixer.clipAction(clip));
    }
    actionsRef.current = actions;

    devLog.info('Animation', `Mixer created: ${clips.length} clips [${clipNames.join(', ')}]`);

    const onFinished = (event: { action: AnimationAction }) => {
      const name = event.action.getClip().name;
      devLog.info('Animation', `Clip finished: "${name}"`);
      onCompleteRef.current?.(name);
    };
    mixer.addEventListener('finished', onFinished as EventListener);

    return () => {
      mixer.removeEventListener('finished', onFinished as EventListener);
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      mixerRef.current = null;
      actionsRef.current.clear();
      devLog.info('Animation', 'Mixer disposed');
    };
  }, [root, clips, clipNames]);

  // Update mixer per frame
  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  const play = useCallback((name: string, options?: PlayOptions): AnimationAction | null => {
    const action = actionsRef.current.get(name);
    if (!action) {
      devLog.warn('Animation', `Clip not found: "${name}" (available: ${[...actionsRef.current.keys()].join(', ')})`);
      return null;
    }

    const loop = options?.loop ?? 'repeat';
    const speed = options?.speed ?? 1.0;
    const clamp = options?.clampWhenFinished ?? true;

    // If already running, just update settings — don't reset to avoid jitter
    if (action.isRunning()) {
      action.timeScale = speed;
      action.setLoop(LOOP_MAP[loop], Infinity);
      action.clampWhenFinished = clamp;
      return action;
    }

    action.setLoop(LOOP_MAP[loop], Infinity);
    action.timeScale = speed;
    action.clampWhenFinished = clamp;
    action.reset().play();

    return action;
  }, []);

  const stop = useCallback(() => {
    mixerRef.current?.stopAllAction();
  }, []);

  const crossFade = useCallback((
    fromName: string,
    toName: string,
    duration: number,
    options?: PlayOptions,
  ) => {
    const fromAction = actionsRef.current.get(fromName);
    const toAction = actionsRef.current.get(toName);

    if (!fromAction || !toAction) {
      devLog.warn('Animation', `crossFade: missing clip(s) — from="${fromName}" to="${toName}"`);
      return;
    }

    const loop = options?.loop ?? 'repeat';
    const speed = options?.speed ?? 1.0;
    const clamp = options?.clampWhenFinished ?? true;

    toAction.setLoop(LOOP_MAP[loop], Infinity);
    toAction.timeScale = speed;
    toAction.clampWhenFinished = clamp;
    toAction.reset().play();

    fromAction.crossFadeTo(toAction, duration, true);
  }, []);

  return {
    play,
    stop,
    crossFade,
    mixer: mixerRef.current,
    clipNames,
  };
}
