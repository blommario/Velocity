/**
 * Latency (ping) indicator — shows round-trip time with color-coded quality dot.
 * Green <50ms, yellow 50-100ms, orange 100-200ms, red >200ms.
 *
 * Depends on: nothing (pure presentational)
 * Used by: Game HUD (multiplayer mode)
 */

export interface LatencyIndicatorProps {
  latencyMs: number;
  className?: string;
}

const LATENCY_THRESHOLDS = [
  { max: 50, color: '#22c55e' },   // green
  { max: 100, color: '#eab308' },  // yellow
  { max: 200, color: '#f97316' },  // orange
] as const;

const BAD_COLOR = '#ef4444'; // red (>200ms)

function getLatencyColor(ms: number): string {
  for (const { max, color } of LATENCY_THRESHOLDS) {
    if (ms < max) return color;
  }
  return BAD_COLOR;
}

export function LatencyIndicator({ latencyMs, className }: LatencyIndicatorProps) {
  const color = getLatencyColor(latencyMs);

  return (
    <div className={className ?? 'absolute top-4 right-4 flex items-center gap-1.5'}>
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-xs text-gray-300">
        {Math.round(latencyMs)} <span className="text-gray-500">ms</span>
      </span>
    </div>
  );
}
