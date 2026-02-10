/**
 * Performance metrics bar — FPS, frametime, peak, memory, draw calls, triangles.
 *
 * Depends on: devLogStore PerfMetrics, devLogFormatters, devLogStyles
 * Used by: DevLogPanel
 */
import type { PerfMetrics } from '../devLogStore';
import { styles } from './devLogStyles';
import { getFpsColor, getFrametimeColor, formatCount } from './devLogFormatters';

export function PerfBar({ perf }: { perf: PerfMetrics }) {
  return (
    <div style={styles.perfBar}>
      <span style={{ color: getFpsColor(perf.fps) }}>{perf.fps} FPS</span>
      <span style={{ color: getFrametimeColor(perf.frametime) }}>{perf.frametime}ms</span>
      <span style={{ color: getFrametimeColor(perf.frametimeMax), opacity: 0.5 }}>
        pk {perf.frametimeMax}ms
      </span>
      <span style={styles.perfSep}>|</span>
      <span style={{ color: '#c084fc' }}>{perf.memoryMB}MB</span>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>DC:{perf.drawCalls}</span>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>Tri:{formatCount(perf.triangles)}</span>
      <span style={{ color: 'rgba(255,255,255,0.2)' }}>G:{perf.geometries} T:{perf.textures}</span>
    </div>
  );
}
