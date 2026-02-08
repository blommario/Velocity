import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { WebGPURenderer } from 'three/webgpu';
import { useDevLogStore } from './devLogStore';

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

  useFrame(() => {
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

    // Renderer info
    const info = (gl as unknown as WebGPURenderer).info;
    const render = info?.render;

    useDevLogStore.getState().updatePerf({
      fps: Math.round(fps),
      frametime: Math.round(avg * 10) / 10,
      frametimeMax: Math.round(max * 10) / 10,
      memoryMB,
      drawCalls: render?.calls ?? 0,
      triangles: render?.triangles ?? 0,
      geometries: info?.memory?.geometries ?? 0,
      textures: info?.memory?.textures ?? 0,
    });
  });

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
