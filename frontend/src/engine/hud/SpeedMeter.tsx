export interface SpeedThreshold {
  min: number;
  color: string;
}

/** Speed tier markers shown on the bar at specific thresholds. */
export interface SpeedTier {
  speed: number;
  label: string;
  color: string;
}

export interface SpeedMeterProps {
  speed: number;
  maxDisplay?: number;
  thresholds?: readonly SpeedThreshold[];
  tiers?: readonly SpeedTier[];
  unit?: string;
  className?: string;
}

const DEFAULT_THRESHOLDS: readonly SpeedThreshold[] = [
  { min: 600, color: '#ff2020' },
  { min: 400, color: '#ff8c00' },
  { min: 200, color: '#ffd700' },
  { min: 0, color: '#ffffff' },
];

function getSpeedColor(speed: number, thresholds: readonly SpeedThreshold[]): string {
  for (const { min, color } of thresholds) {
    if (speed >= min) return color;
  }
  return thresholds[thresholds.length - 1]?.color ?? '#ffffff';
}

function getActiveTier(speed: number, tiers: readonly SpeedTier[]): SpeedTier | null {
  let best: SpeedTier | null = null;
  for (const tier of tiers) {
    if (speed >= tier.speed && (!best || tier.speed > best.speed)) {
      best = tier;
    }
  }
  return best;
}

export function SpeedMeter({
  speed,
  maxDisplay = 1000,
  thresholds = DEFAULT_THRESHOLDS,
  tiers,
  unit = 'u/s',
  className,
}: SpeedMeterProps) {
  const fraction = Math.min(speed / maxDisplay, 1);
  const color = getSpeedColor(speed, thresholds);
  const activeTier = tiers ? getActiveTier(speed, tiers) : null;

  return (
    <div className={className ?? 'absolute bottom-24 left-8 w-64'}>
      <div className="relative h-2 bg-gray-800/80 rounded overflow-hidden">
        <div
          className="h-full w-full rounded origin-left will-change-transform"
          style={{ transform: `scaleX(${fraction})`, backgroundColor: color, transition: 'transform 75ms linear' }}
        />
        {tiers?.map((tier) => (
          <div
            key={tier.speed}
            className="absolute top-0 h-full w-px"
            style={{
              left: `${Math.min(tier.speed / maxDisplay, 1) * 100}%`,
              backgroundColor: tier.color,
              opacity: speed >= tier.speed ? 0.9 : 0.25,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold" style={{ color }}>
          {Math.round(speed)} <span className="text-xs opacity-60">{unit}</span>
        </span>
        {activeTier && (
          <span
            className="text-xs font-bold uppercase tracking-wider animate-pulse"
            style={{ color: activeTier.color }}
          >
            {activeTier.label}
          </span>
        )}
      </div>
    </div>
  );
}
