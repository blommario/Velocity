/**
 * Reusable property input widgets for the map editor — Vec3, number, color,
 * select, and checkbox inputs with consistent styling.
 *
 * Depends on: (none — pure UI components)
 * Used by: PropertiesPanel
 */
import type { Vec3 } from '../game/map/types';

export function PropVec3({ label, value, onChange }: { label: string; value: Vec3; onChange: (v: Vec3) => void }) {
  return (
    <div>
      <label className="text-gray-500 text-[10px] uppercase">{label}</label>
      <Vec3Input value={value} onChange={onChange} />
    </div>
  );
}

export function Vec3Input({ value, onChange }: { value: Vec3; onChange: (v: Vec3) => void }) {
  return (
    <div className="flex gap-1">
      {(['x', 'y', 'z'] as const).map((axis, i) => (
        <input
          key={axis}
          type="number"
          value={value[i]}
          onChange={(e) => {
            const v = [...value] as Vec3;
            v[i] = parseFloat(e.target.value) || 0;
            onChange(v);
          }}
          className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-white text-center"
          step="0.5"
        />
      ))}
    </div>
  );
}

export function PropNumber({ label, value, onChange, min, max, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="text-gray-500 text-[10px] uppercase">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white"
      />
    </div>
  );
}

export function PropColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-gray-500 text-[10px] uppercase flex-1">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-5 rounded border border-gray-700 cursor-pointer bg-transparent"
      />
    </div>
  );
}

export function PropSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-gray-500 text-[10px] uppercase">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

export function PropCheck({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-700"
      />
      <span className="text-gray-400">{label}</span>
    </label>
  );
}
