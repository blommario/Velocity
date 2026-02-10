export interface TrackProgressBarProps {
  /** Current progress value (e.g. checkpoints reached) */
  current: number;
  /** Total segments (e.g. checkpoints + finish) */
  total: number;
  /** Force 100% progress (e.g. when finished) */
  completed?: boolean;
  /** Number of segment markers to show (default: total - 1) */
  markerCount?: number;
  /** Bar color (default: green-400) */
  barColor?: string;
  /** Active marker color (default: green-400/60) */
  activeMarkerColor?: string;
  /** Inactive marker color (default: white/30) */
  inactiveMarkerColor?: string;
  className?: string;
}

export function TrackProgressBar({
  current,
  total,
  completed,
  markerCount,
  barColor = 'rgba(74, 222, 128, 0.8)',
  activeMarkerColor = 'rgba(74, 222, 128, 0.6)',
  inactiveMarkerColor = 'rgba(255, 255, 255, 0.3)',
  className,
}: TrackProgressBarProps) {
  if (total === 0) return null;

  const progress = completed ? 1 : current / total;
  const markers = markerCount ?? Math.max(0, total - 1);

  return (
    <div className={className ?? 'absolute bottom-0 left-0 right-0 h-1 bg-white/10'}>
      <div
        className="h-full transition-[width] duration-300 ease-out"
        style={{ width: `${progress * 100}%`, backgroundColor: barColor }}
      />
      {Array.from({ length: markers }, (_, i) => {
        const pos = ((i + 1) / total) * 100;
        return (
          <div
            key={i}
            className="absolute top-0 h-full w-0.5"
            style={{
              left: `${pos}%`,
              backgroundColor: i < current ? activeMarkerColor : inactiveMarkerColor,
            }}
          />
        );
      })}
    </div>
  );
}
