/**
 * Frame profiler bar — stacked timing bar + per-system millisecond labels.
 *
 * Depends on: devLogStore FrameTimings, devLogStyles
 * Used by: DevLogPanel
 */
import type { FrameTimings } from '../devLogStore';
import { getTimingColor } from './devLogStyles';

export function ProfilerBar({ timings, frametime }: { timings: FrameTimings; frametime: number }) {
  const entries = Object.entries(timings).filter(([, ms]) => ms > 0);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, ms]) => sum + ms, 0);

  return (
    <div style={{
      padding: '4px 10px',
      background: 'rgba(10,10,16,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        display: 'flex',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.04)',
        marginBottom: 3,
      }}>
        {entries.map(([system, ms]) => (
          <div
            key={system}
            style={{
              width: `${Math.max((ms / Math.max(frametime, 1)) * 100, 1)}%`,
              background: getTimingColor(system),
              opacity: 0.8,
            }}
            title={`${system}: ${ms.toFixed(2)}ms`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {entries.map(([system, ms]) => (
          <span
            key={system}
            style={{ fontSize: 9, color: getTimingColor(system), cursor: 'pointer' }}
            onClick={() => navigator.clipboard.writeText(`${system}: ${ms.toFixed(2)}ms`)}
            title="Click to copy"
          >
            {system}:{ms.toFixed(1)}ms
          </span>
        ))}
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
          total:{total.toFixed(1)}ms
        </span>
      </div>
    </div>
  );
}
