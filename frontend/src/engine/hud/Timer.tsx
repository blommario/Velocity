export interface TimerProps {
  /** Elapsed time in milliseconds */
  time: number;
  /** Optional custom time formatter (default: MM:SS.mmm) */
  formatter?: (ms: number) => string;
  /** Additional CSS class on the root element */
  className?: string;
}

function defaultFormat(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');

  return `${mm}:${ss}.${mmm}`;
}

export function Timer({ time, formatter, className }: TimerProps) {
  const display = (formatter ?? defaultFormat)(time);

  return (
    <div className={className ?? 'absolute top-6 left-6'}>
      <div className="font-mono text-3xl font-bold text-white/90 tabular-nums">
        {display}
      </div>
    </div>
  );
}
