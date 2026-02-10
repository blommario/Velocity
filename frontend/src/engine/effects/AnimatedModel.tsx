/**
 * Renders a 3D model with animation playback support, loading via URL or accepting a pre-loaded scene.
 * Depends on: useAnimation hook, assetManager (dynamic import from game/services), devLogStore
 * Used by: Game components that need animated 3D models (e.g. weapon viewmodels, NPCs)
 */
import { useEffect, useRef, useState } from 'react';
import type { Group, AnimationClip } from 'three/webgpu';
import { useAnimation, type AnimationLoopMode } from './useAnimation';
import { devLog } from '../stores/devLogStore';

// ── Types ──

export interface AnimatedModelProps {
  /** Model URL (relative to /assets/models/). Loads via assetManager. */
  url?: string;
  /** Pre-loaded scene (alternative to url). */
  scene?: Group;
  /** Pre-loaded animation clips (required when using scene prop). */
  clips?: AnimationClip[];
  /** Name of the animation clip to play. Undefined = no animation. */
  animation?: string;
  /** Loop mode. Default: 'repeat' */
  loop?: AnimationLoopMode;
  /** Playback speed multiplier. Default: 1.0 */
  speed?: number;
  /** Called when a LoopOnce animation finishes. */
  onComplete?: (clipName: string) => void;
  /** Position in world space. */
  position?: [number, number, number];
  /** Rotation in radians (euler). */
  rotation?: [number, number, number];
  /** Scale. */
  scale?: [number, number, number];
}

// ── Component ──

export function AnimatedModel({
  url,
  scene: externalScene,
  clips: externalClips,
  animation,
  loop = 'repeat',
  speed = 1.0,
  onComplete,
  position,
  rotation,
  scale,
}: AnimatedModelProps) {
  const [loadedScene, setLoadedScene] = useState<Group | null>(null);
  const [loadedClips, setLoadedClips] = useState<AnimationClip[]>([]);
  const groupRef = useRef<Group>(null);

  const activeScene = externalScene ?? loadedScene;
  const activeClips = externalClips ?? loadedClips;

  // Load model when url is provided (scene prop takes priority)
  useEffect(() => {
    if (url && externalScene) {
      devLog.warn('AnimatedModel', `Both url="${url}" and scene provided — scene takes priority`);
    }
    if (!url || externalScene) return;
    let disposed = false;

    // Dynamic import avoids static engine→game dependency.
    // Uses relative path to game service — intentional boundary exception for lazy loading.
    import('../../game/services/assetManager').then(({ loadModelWithAnimations }) => {
      loadModelWithAnimations(url)
        .then((asset) => {
          if (disposed) return;
          setLoadedScene(asset.scene);
          setLoadedClips(asset.animations);
          devLog.info('AnimatedModel', `Loaded "${url}" (${asset.animations.length} clips)`);
        })
        .catch((err: unknown) => {
          devLog.error('AnimatedModel', `Failed to load "${url}": ${err instanceof Error ? err.message : String(err)}`);
        });
    });

    return () => {
      disposed = true;
      setLoadedScene(null);
      setLoadedClips([]);
    };
  }, [url, externalScene]);

  // Animation playback
  const { play, stop } = useAnimation({
    root: activeScene,
    clips: activeClips,
    onComplete,
  });

  // Play/switch animation when props change
  useEffect(() => {
    if (!animation || !activeScene) {
      stop();
      return;
    }
    play(animation, { loop, speed });
  }, [animation, loop, speed, activeScene, play, stop]);

  if (!activeScene) return null;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={activeScene} />
    </group>
  );
}
