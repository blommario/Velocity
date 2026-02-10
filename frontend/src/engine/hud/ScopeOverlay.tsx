/**
 * ScopeOverlay — generic fullscreen scope HUD overlay.
 *
 * Renders a circular scope window with black vignette mask, crosshair reticle
 * with mil-dots, optional sway offset, and optional breath-hold bar.
 * Engine component — all state via props, no game store imports.
 *
 * Performance: MilDots and static reticle elements are memoized.
 * Sway updates at ~30Hz via store throttle in physics tick.
 */
import { memo } from 'react';

export interface ScopeOverlayConfig {
  /** Scope circle diameter as vmin percentage (default 70) */
  diameterVmin?: number;
  /** Reticle color (default purple) */
  reticleColor?: string;
  /** Mask background color (default near-black) */
  maskColor?: string;
  /** Number of mil-dot ticks per arm (default 5) */
  milDotCount?: number;
  /** Spacing between mil-dots as % of scope diameter (default 4) */
  milDotSpacing?: number;
}

export interface ScopeOverlayProps {
  /** ADS progress 0–1. Overlay fades in from fadeThreshold to 1. */
  adsProgress: number;
  /** Sway offset X in normalized range (typically -1..1) */
  swayX?: number;
  /** Sway offset Y in normalized range (typically -1..1) */
  swayY?: number;
  /** Whether breath is being held — shows breath bar */
  isHoldingBreath?: boolean;
  /** How long breath has been held (seconds) */
  breathHoldTime?: number;
  /** Max breath hold duration (seconds, for bar calculation) */
  breathHoldMax?: number;
  /** ADS progress at which overlay starts fading in (default 0.85) */
  fadeThreshold?: number;
  /** Visual config overrides */
  config?: ScopeOverlayConfig;
}

const DEFAULTS: Required<ScopeOverlayConfig> = {
  diameterVmin: 70,
  reticleColor: 'rgba(167,139,250,0.85)',
  maskColor: 'rgba(0,0,0,0.95)',
  milDotCount: 5,
  milDotSpacing: 4,
} as const;

export function ScopeOverlay({
  adsProgress,
  swayX = 0,
  swayY = 0,
  isHoldingBreath = false,
  breathHoldTime = 0,
  breathHoldMax = 2,
  fadeThreshold = 0.85,
  config,
}: ScopeOverlayProps) {
  const {
    diameterVmin,
    reticleColor,
    maskColor,
    milDotCount,
    milDotSpacing,
  } = { ...DEFAULTS, ...config };

  if (adsProgress < fadeThreshold) return null;

  const fadeIn = Math.min(1, (adsProgress - fadeThreshold) / (1 - fadeThreshold));
  const swayTranslate = `translate(${swayX * 2}vmin, ${swayY * 2}vmin)`;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: fadeIn }}
    >
      {/* Black vignette mask with circular hole */}
      <div className="absolute inset-0" style={{ background: maskColor }}>
        <div
          className="absolute rounded-full"
          style={{
            width: `${diameterVmin}vmin`,
            height: `${diameterVmin}vmin`,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) ${swayTranslate}`,
            boxShadow: `0 0 0 200vmax ${maskColor}`,
            background: 'transparent',
          }}
        />
      </div>

      {/* Scope reticle group — moves with sway */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) ${swayTranslate}`,
          width: `${diameterVmin}vmin`,
          height: `${diameterVmin}vmin`,
        }}
      >
        {/* Scope ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${reticleColor}`,
            boxShadow: `inset 0 0 0 3px ${reticleColor.replace(/[\d.]+\)$/, '0.15)')}`,
          }}
        />

        {/* Horizontal crosshair line */}
        <div
          className="absolute"
          style={{
            top: '50%', left: '7.5%', right: '7.5%',
            height: 1, backgroundColor: reticleColor,
            transform: 'translateY(-50%)',
          }}
        />
        {/* Vertical crosshair line */}
        <div
          className="absolute"
          style={{
            left: '50%', top: '7.5%', bottom: '7.5%',
            width: 1, backgroundColor: reticleColor,
            transform: 'translateX(-50%)',
          }}
        />

        {/* Center gap — hides cross at center */}
        <div
          className="absolute"
          style={{
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 16, height: 16,
          }}
        >
          <div className="absolute" style={{
            top: '50%', left: 0, right: 0, height: 1,
            backgroundColor: 'black', transform: 'translateY(-50%)',
          }} />
          <div className="absolute" style={{
            left: '50%', top: 0, bottom: 0, width: 1,
            backgroundColor: 'black', transform: 'translateX(-50%)',
          }} />
        </div>

        {/* Center dot */}
        <div
          className="absolute rounded-full"
          style={{
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 3, height: 3,
            backgroundColor: reticleColor,
          }}
        />

        {/* Mil-dots */}
        <MilDots direction="horizontal" count={milDotCount} spacing={milDotSpacing} color={reticleColor} />
        <MilDots direction="vertical" count={milDotCount} spacing={milDotSpacing} color={reticleColor} />
      </div>

      {/* Breath hold bar */}
      {isHoldingBreath && (
        <BreathHoldBar
          breathHoldTime={breathHoldTime}
          breathHoldMax={breathHoldMax}
          color={reticleColor}
        />
      )}
    </div>
  );
}

const MilDots = memo(function MilDots({ direction, count, spacing, color }: {
  direction: 'horizontal' | 'vertical';
  count: number;
  spacing: number;
  color: string;
}) {
  const isH = direction === 'horizontal';

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const offset = (i + 1) * spacing;
        const pos = 50 + offset;
        const neg = 50 - offset;

        const style = (pct: number) => isH
          ? { left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 1, height: 4 }
          : { top: `${pct}%`, left: '50%', transform: 'translate(-50%, -50%)', width: 4, height: 1 };

        return (
          <div key={`${direction}${i}`}>
            <div className="absolute" style={{ ...style(pos), backgroundColor: color }} />
            <div className="absolute" style={{ ...style(neg), backgroundColor: color }} />
          </div>
        );
      })}
    </>
  );
});

function BreathHoldBar({ breathHoldTime, breathHoldMax, color }: {
  breathHoldTime: number;
  breathHoldMax: number;
  color: string;
}) {
  const remaining = Math.max(0, 1 - breathHoldTime / breathHoldMax);

  return (
    <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
      <div className="w-20 h-[3px] bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${remaining * 100}%`,
            backgroundColor: remaining > 0.3 ? color : 'rgba(239,68,68,0.8)',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  );
}
