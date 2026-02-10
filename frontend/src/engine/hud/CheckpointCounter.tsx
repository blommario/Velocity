export interface CheckpointCounterProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export function CheckpointCounter({
  current,
  total,
  label = 'CP',
  className,
}: CheckpointCounterProps) {
  if (total === 0) return null;

  return (
    <div className={className ?? 'absolute top-4 right-6 font-mono text-sm text-white/80'}>
      {label} {current}/{total}
    </div>
  );
}
