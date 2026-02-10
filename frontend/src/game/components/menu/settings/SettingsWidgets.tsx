/**
 * Shared UI primitives for the settings screen — section titles, sliders,
 * toggles, selects, and color pickers with consistent styling.
 *
 * Depends on: React
 * Used by: All settings tab components (MouseSettings, VideoSettings, etc.)
 */
import type { ReactNode } from 'react';

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-white/80 mb-4">{children}</h2>
  );
}

export function SubSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-mono mb-2">{children}</h3>
  );
}

export function SliderSetting({ label, value, min, max, step, onChange, displayValue }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; displayValue: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-400 w-28 flex-shrink-0 text-sm">{label}</span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-cyan-500"
      />
      <span className="text-gray-500 font-mono w-16 text-right text-xs">{displayValue}</span>
    </div>
  );
}

export function ToggleSetting({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <span className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-all cursor-pointer ${
          value
            ? 'bg-cyan-500/80 shadow-sm shadow-cyan-500/30'
            : 'bg-white/[0.08] border border-white/[0.06]'
        }`}
      >
        <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${value ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

export function SelectSetting({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-400 w-28 flex-shrink-0 text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500/40"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#12121a]">{opt}</option>
        ))}
      </select>
    </div>
  );
}

export function ColorSetting({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-400 w-28 flex-shrink-0 text-sm">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-6 rounded border border-white/[0.08] cursor-pointer bg-transparent"
      />
      <span className="text-gray-600 font-mono text-xs">{value}</span>
    </div>
  );
}
