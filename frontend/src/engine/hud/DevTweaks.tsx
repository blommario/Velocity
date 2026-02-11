/**
 * Developer slider panel for runtime physics/gameplay tweaks.
 *
 * Depends on: —
 * Used by: game HUD (dev mode only)
 */
export interface DevSlider {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  accentColor: string;
  onChange: (value: number) => void;
}

export interface DevTweaksProps {
  sliders: readonly DevSlider[];
  onReset?: () => void;
  className?: string;
}

export function DevTweaks({ sliders, onReset, className }: DevTweaksProps) {
  return (
    <div className={className ?? 'absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto select-none'}>
      <div className="flex gap-6 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3">
        {sliders.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1 w-44">
            <label className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
              {s.label}
            </label>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.value}
              onChange={(e) => s.onChange(parseFloat(e.target.value))}
              className="w-full h-1.5 cursor-pointer"
              style={{ accentColor: s.accentColor }}
            />
            <span className="text-xs font-mono font-bold" style={{ color: s.accentColor }}>
              {s.displayValue}
            </span>
          </div>
        ))}

        {onReset && (
          <div className="flex items-center">
            <button
              onClick={onReset}
              className="text-[10px] font-mono text-white/40 hover:text-white/80 border border-white/10 hover:border-white/30 rounded px-2 py-1 transition-colors"
            >
              RESET
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
