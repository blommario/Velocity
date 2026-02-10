/**
 * ReadySignal — waits for WebGPU shader compilation to stabilise before
 * dismissing the loading screen. Measures consecutive stable frametimes.
 *
 * Depends on: gameStore
 * Used by: GameCanvas
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@game/stores/gameStore';

const STABLE_FRAME_MS = 18;
const STABLE_FRAMES_NEEDED = 20;
const MIN_WARMUP_FRAMES = 40;
const FALLBACK_TIMEOUT_MS = 8000;

export function ReadySignal() {
  const frameCount = useRef(0);
  const stableCount = useRef(0);
  const startTime = useRef(performance.now());
  const fired = useRef(false);

  useFrame((_, delta) => {
    if (fired.current) return;

    frameCount.current++;
    const elapsed = performance.now() - startTime.current;
    const frameMs = delta * 1000;

    const warmupProgress = Math.min(frameCount.current / MIN_WARMUP_FRAMES, 1);
    const progress = 0.8 + warmupProgress * 0.15;
    useGameStore.getState().setLoadProgress(progress, 'Compiling shaders...');

    if (frameCount.current < MIN_WARMUP_FRAMES) return;

    if (frameMs < STABLE_FRAME_MS) {
      stableCount.current++;
    } else {
      stableCount.current = 0;
    }

    if (stableCount.current >= STABLE_FRAMES_NEEDED || elapsed > FALLBACK_TIMEOUT_MS) {
      fired.current = true;
      useGameStore.getState().setLoadProgress(1, 'Ready');
      requestAnimationFrame(() => {
        useGameStore.getState().finishLoading();
      });
    }
  });

  return null;
}
