/**
 * Circular reload progress indicator rendered around the crosshair center.
 * Depends on: none (pure props)
 * Used by: Game CombatHud (via HudOverlay)
 */

export interface ReloadIndicatorProps {
  /** Reload progress 0–1. Hidden when 0. */
  progress: number;
  /** Whether reload is active. */
  active: boolean;
  /** Ring radius in pixels. */
  radius?: number;
  /** Ring stroke width in pixels. */
  strokeWidth?: number;
  /** Ring color. */
  color?: string;
}

const DEFAULTS = {
  RADIUS: 24,
  STROKE: 2.5,
  COLOR: '#ffffff',
} as const;

export function ReloadIndicator({
  progress,
  active,
  radius = DEFAULTS.RADIUS,
  strokeWidth = DEFAULTS.STROKE,
  color = DEFAULTS.COLOR,
}: ReloadIndicatorProps) {
  if (!active || progress <= 0) return null;

  const size = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 10 }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={0.2}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          opacity={0.9}
        />
      </svg>
    </div>
  );
}
