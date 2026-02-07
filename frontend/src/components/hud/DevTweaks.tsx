import { useSettingsStore } from '../../stores/settingsStore';
import { PHYSICS } from '../game/physics/constants';

const BASE_SPEED = PHYSICS.GROUND_MAX_SPEED; // 320 u/s
const BASE_GRAVITY = PHYSICS.GRAVITY;         // 800 u/s²

const SPEED_RANGE = { min: 0.05, max: 0.625, step: 0.025 } as const; // 16–200 u/s
const GRAVITY_RANGE = { min: 0.05, max: 0.5, step: 0.025 } as const; // 40–400 u/s²

export function DevTweaks() {
  const speedMult = useSettingsStore((s) => s.devSpeedMultiplier);
  const gravMult = useSettingsStore((s) => s.devGravityMultiplier);

  const speedUs = Math.round(BASE_SPEED * speedMult);

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto select-none">
      <div className="flex gap-6 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3">
        {/* Speed slider */}
        <div className="flex flex-col items-center gap-1 w-44">
          <label className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
            Max Speed
          </label>
          <input
            type="range"
            min={SPEED_RANGE.min}
            max={SPEED_RANGE.max}
            step={SPEED_RANGE.step}
            value={speedMult}
            onChange={(e) => useSettingsStore.getState().setDevSpeedMultiplier(parseFloat(e.target.value))}
            className="w-full h-1.5 accent-cyan-400 cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-cyan-400">
            {speedUs} u/s
          </span>
        </div>

        {/* Gravity slider */}
        <div className="flex flex-col items-center gap-1 w-40">
          <label className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
            Gravity
          </label>
          <input
            type="range"
            min={GRAVITY_RANGE.min}
            max={GRAVITY_RANGE.max}
            step={GRAVITY_RANGE.step}
            value={gravMult}
            onChange={(e) => useSettingsStore.getState().setDevGravityMultiplier(parseFloat(e.target.value))}
            className="w-full h-1.5 accent-orange-400 cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-orange-400">
            {Math.round(BASE_GRAVITY * gravMult)} u/s²
          </span>
        </div>

        {/* Reset button */}
        <div className="flex items-center">
          <button
            onClick={() => {
              useSettingsStore.getState().setDevSpeedMultiplier(0.5);
              useSettingsStore.getState().setDevGravityMultiplier(0.5);
            }}
            className="text-[10px] font-mono text-white/40 hover:text-white/80 border border-white/10 hover:border-white/30 rounded px-2 py-1 transition-colors"
          >
            RESET
          </button>
        </div>
      </div>
    </div>
  );
}
