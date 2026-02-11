/**
 * Invisible R3F component measuring FPS, frametime, memory, and draw calls.
 *
 * Depends on: R3F useFrame, devLogStore (perf metrics), frameTiming
 * Used by: Canvas scene (mounted once)
 */
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { WebGPURenderer } from 'three/webgpu';
import { useDevLogStore, frameTiming } from './devLogStore';

const PERF = {
  /** How often to update the store (ms) */
  UPDATE_INTERVAL: 1000,
  /** How many frame samples to average over */
  SAMPLE_SIZE: 60,
} as const;

/**
 * Invisible component that measures FPS, frametime, memory and renderer stats.
 * Pushes metrics to devLogStore.perf every second.
 * Mount inside <Canvas>.
 */
export function PerfMonitor() {
  const gl = useThree((s) => s.gl);
  const frametimesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(0);
  const lastFrameRef = useRef(performance.now());

  // Ensure renderer.info resets per frame (WebGPU needs this for accurate DC/tri counts)
  const autoResetRef = useRef(false);
  if (!autoResetRef.current) {
    const info = (gl as unknown as WebGPURenderer).info;
    if (info) {
      info.autoReset = true;
      autoResetRef.current = true;
    }
  }

  // Priority 2: runs AFTER PostProcessingEffects (priority 1) so we read fresh per-frame values
  useFrame(() => {
    // Reset per-frame timing accumulators (before any system writes this frame)
    frameTiming.resetFrame();

    const now = performance.now();
    const dt = now - lastFrameRef.current;
    lastFrameRef.current = now;

    const frametimes = frametimesRef.current;
    frametimes.push(dt);
    if (frametimes.length > PERF.SAMPLE_SIZE) frametimes.shift();

    if (now - lastUpdateRef.current < PERF.UPDATE_INTERVAL) return;
    lastUpdateRef.current = now;

    // Average + max frametime
    let sum = 0;
    let max = 0;
    for (const ft of frametimes) {
      sum += ft;
      if (ft > max) max = ft;
    }
    const avg = frametimes.length > 0 ? sum / frametimes.length : 0;
    const fps = avg > 0 ? 1000 / avg : 0;

    // Memory (Chrome only)
    const mem = (performance as PerformanceWithMemory).memory;
    const memoryMB = mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : 0;

    // Renderer info — use per-frame counters (drawCalls/frameCalls/triangles),
    // NOT lifetime counters (calls). autoReset=true handles clearing each frame.
    const info = (gl as unknown as WebGPURenderer).info;
    const render = info?.render;

    const store = useDevLogStore.getState();
    store.updatePerf({
      fps: Math.round(fps),
      frametime: Math.round(avg * 10) / 10,
      frametimeMax: Math.round(max * 10) / 10,
      memoryMB,
      drawCalls: render?.drawCalls ?? 0,
      triangles: render?.triangles ?? 0,
      geometries: info?.memory?.geometries ?? 0,
      textures: info?.memory?.textures ?? 0,
    });
    store.updateTimings(frameTiming.snapshot());
  }, 2);

  return null;
}

/** Chrome-specific Performance.memory type */
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}
