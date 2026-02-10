export interface SpeedThreshold {
  min: number;
  color: string;
}

export interface SpeedMeterProps {
  speed: number;
  maxDisplay?: number;
  thresholds?: readonly SpeedThreshold[];
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

export function SpeedMeter({
  speed,
  maxDisplay = 1000,
  thresholds = DEFAULT_THRESHOLDS,
  unit = 'u/s',
  className,
}: SpeedMeterProps) {
  const fraction = Math.min(speed / maxDisplay, 1);
  const color = getSpeedColor(speed, thresholds);

  return (
    <div className={className ?? 'absolute bottom-24 left-8 w-64'}>
      <div className="h-2 bg-gray-800/80 rounded overflow-hidden">
        <div
          className="h-full rounded transition-[width] duration-75"
          style={{ width: `${fraction * 100}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1 font-mono text-lg font-bold" style={{ color }}>
        {Math.round(speed)} <span className="text-xs opacity-60">{unit}</span>
      </div>
    </div>
  );
}
