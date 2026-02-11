/**
 * Shows current player stance (crouch/slide/prone) with icon + label.
 *
 * Depends on: —
 * Used by: game HUD composition
 */
export type StanceType = 'standing' | 'crouching' | 'sliding' | 'prone';

export interface StanceIndicatorProps {
  stance: StanceType;
  className?: string;
}

const STANCE_LABELS: Record<StanceType, string> = {
  standing: '',
  crouching: 'CROUCH',
  sliding: 'SLIDE',
  prone: 'PRONE',
};

const STANCE_COLORS: Record<StanceType, string> = {
  standing: 'transparent',
  crouching: '#fbbf24',
  sliding: '#3b82f6',
  prone: '#ef4444',
};

/** SVG icons per stance (small, inline). */
function StanceIcon({ stance }: { stance: StanceType }) {
  const color = STANCE_COLORS[stance];
  if (stance === 'standing') return null;

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {stance === 'crouching' && (
        <>
          <circle cx="10" cy="5" r="2.5" fill={color} />
          <path d="M7 9 L10 13 L13 9" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="8" y1="15" x2="12" y2="15" stroke={color} strokeWidth="1.5" />
        </>
      )}
      {stance === 'sliding' && (
        <>
          <circle cx="6" cy="5" r="2.5" fill={color} />
          <line x1="4" y1="12" x2="16" y2="8" stroke={color} strokeWidth="1.5" />
          <line x1="4" y1="15" x2="16" y2="15" stroke={color} strokeWidth="1.5" />
        </>
      )}
      {stance === 'prone' && (
        <>
          <circle cx="4" cy="10" r="2.5" fill={color} />
          <line x1="6" y1="10" x2="18" y2="10" stroke={color} strokeWidth="1.5" />
          <line x1="2" y1="15" x2="18" y2="15" stroke={color} strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

export function StanceIndicator({ stance, className }: StanceIndicatorProps) {
  if (stance === 'standing') return null;

  const label = STANCE_LABELS[stance];
  const color = STANCE_COLORS[stance];

  return (
    <div
      className={className ?? 'absolute bottom-8 left-8'}
      style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.8 }}
    >
      <StanceIcon stance={stance} />
      <span
        className="font-mono text-xs font-bold uppercase"
        style={{ color, letterSpacing: '0.05em' }}
      >
        {label}
      </span>
    </div>
  );
}
