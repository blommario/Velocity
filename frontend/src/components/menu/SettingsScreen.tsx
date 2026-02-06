import { useState } from 'react';
import { useGameStore, SCREENS } from '../../stores/gameStore';
import {
  useSettingsStore,
  CROSSHAIR_STYLES, QUALITY_PRESETS,
  DEFAULT_KEY_BINDINGS,
  type CrosshairStyle, type QualityPreset,
} from '../../stores/settingsStore';

const SETTINGS_TABS = {
  MOUSE: 'mouse',
  VIDEO: 'video',
  AUDIO: 'audio',
  GAMEPLAY: 'gameplay',
  HUD: 'hud',
  KEYBINDS: 'keybinds',
} as const;

type SettingsTab = (typeof SETTINGS_TABS)[keyof typeof SETTINGS_TABS];

const TAB_LABELS: { tab: SettingsTab; label: string }[] = [
  { tab: SETTINGS_TABS.MOUSE, label: 'Mouse' },
  { tab: SETTINGS_TABS.VIDEO, label: 'Video' },
  { tab: SETTINGS_TABS.AUDIO, label: 'Audio' },
  { tab: SETTINGS_TABS.GAMEPLAY, label: 'Gameplay' },
  { tab: SETTINGS_TABS.HUD, label: 'HUD' },
  { tab: SETTINGS_TABS.KEYBINDS, label: 'Key Binds' },
];

export function SettingsScreen() {
  const [tab, setTab] = useState<SettingsTab>(SETTINGS_TABS.MOUSE);
  const setScreen = useGameStore((s) => s.setScreen);
  const resetAll = useSettingsStore((s) => s.resetAll);

  return (
    <div className="w-screen h-screen bg-gray-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex gap-3">
          <button
            onClick={resetAll}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Reset All
          </button>
          <button
            onClick={() => setScreen(SCREENS.MAIN_MENU)}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded text-sm transition-colors cursor-pointer"
          >
            Back
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Tabs */}
        <div className="w-48 bg-gray-900 border-r border-gray-800 py-2">
          {TAB_LABELS.map(({ tab: t, label }) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                tab === t ? 'bg-white/10 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
          {tab === SETTINGS_TABS.MOUSE && <MouseSettings />}
          {tab === SETTINGS_TABS.VIDEO && <VideoSettings />}
          {tab === SETTINGS_TABS.AUDIO && <AudioSettings />}
          {tab === SETTINGS_TABS.GAMEPLAY && <GameplaySettings />}
          {tab === SETTINGS_TABS.HUD && <HudSettings />}
          {tab === SETTINGS_TABS.KEYBINDS && <KeyBindSettings />}
        </div>
      </div>
    </div>
  );
}

// ── Mouse ──

function MouseSettings() {
  const sensitivity = useSettingsStore((s) => s.sensitivity);
  const setSensitivity = useSettingsStore((s) => s.setSensitivity);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold mb-4">Mouse</h2>
      <SliderSetting
        label="Sensitivity"
        value={sensitivity}
        min={0.1}
        max={10}
        step={0.1}
        onChange={setSensitivity}
        displayValue={sensitivity.toFixed(1)}
      />
    </div>
  );
}

// ── Video ──

function VideoSettings() {
  const fov = useSettingsStore((s) => s.fov);
  const setFov = useSettingsStore((s) => s.setFov);
  const qualityPreset = useSettingsStore((s) => s.qualityPreset);
  const setQualityPreset = useSettingsStore((s) => s.setQualityPreset);
  const shadows = useSettingsStore((s) => s.shadows);
  const setShadows = useSettingsStore((s) => s.setShadows);
  const particles = useSettingsStore((s) => s.particles);
  const setParticles = useSettingsStore((s) => s.setParticles);
  const speedLines = useSettingsStore((s) => s.speedLines);
  const setSpeedLines = useSettingsStore((s) => s.setSpeedLines);
  const screenShake = useSettingsStore((s) => s.screenShake);
  const setScreenShake = useSettingsStore((s) => s.setScreenShake);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold mb-4">Video</h2>
      <SliderSetting label="FOV" value={fov} min={80} max={130} step={1} onChange={setFov} displayValue={`${fov}`} />
      <SelectSetting
        label="Quality"
        value={qualityPreset}
        options={Object.values(QUALITY_PRESETS)}
        onChange={(v) => setQualityPreset(v as QualityPreset)}
      />
      <ToggleSetting label="Shadows" value={shadows} onChange={setShadows} />
      <ToggleSetting label="Particles" value={particles} onChange={setParticles} />
      <ToggleSetting label="Speed Lines" value={speedLines} onChange={setSpeedLines} />
      <ToggleSetting label="Screen Shake" value={screenShake} onChange={setScreenShake} />
    </div>
  );
}

// ── Audio ──

function AudioSettings() {
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const ambientVolume = useSettingsStore((s) => s.ambientVolume);
  const setAmbientVolume = useSettingsStore((s) => s.setAmbientVolume);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold mb-4">Audio</h2>
      <SliderSetting label="Master" value={masterVolume} min={0} max={1} step={0.05} onChange={setMasterVolume} displayValue={`${Math.round(masterVolume * 100)}%`} />
      <SliderSetting label="SFX" value={sfxVolume} min={0} max={1} step={0.05} onChange={setSfxVolume} displayValue={`${Math.round(sfxVolume * 100)}%`} />
      <SliderSetting label="Music" value={musicVolume} min={0} max={1} step={0.05} onChange={setMusicVolume} displayValue={`${Math.round(musicVolume * 100)}%`} />
      <SliderSetting label="Ambient" value={ambientVolume} min={0} max={1} step={0.05} onChange={setAmbientVolume} displayValue={`${Math.round(ambientVolume * 100)}%`} />
    </div>
  );
}

// ── Gameplay ──

function GameplaySettings() {
  const autoBhop = useSettingsStore((s) => s.autoBhop);
  const setAutoBhop = useSettingsStore((s) => s.setAutoBhop);
  const crosshairStyle = useSettingsStore((s) => s.crosshairStyle);
  const setCrosshairStyle = useSettingsStore((s) => s.setCrosshairStyle);
  const crosshairColor = useSettingsStore((s) => s.crosshairColor);
  const setCrosshairColor = useSettingsStore((s) => s.setCrosshairColor);
  const crosshairSize = useSettingsStore((s) => s.crosshairSize);
  const setCrosshairSize = useSettingsStore((s) => s.setCrosshairSize);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold mb-4">Gameplay</h2>
      <ToggleSetting label="Auto Bunny Hop" value={autoBhop} onChange={setAutoBhop} />

      <h3 className="text-sm text-gray-400 uppercase tracking-wider mt-6 mb-2">Crosshair</h3>
      <SelectSetting
        label="Style"
        value={crosshairStyle}
        options={Object.values(CROSSHAIR_STYLES)}
        onChange={(v) => setCrosshairStyle(v as CrosshairStyle)}
      />
      <ColorSetting label="Color" value={crosshairColor} onChange={setCrosshairColor} />
      <SliderSetting label="Size" value={crosshairSize} min={1} max={20} step={1} onChange={setCrosshairSize} displayValue={`${crosshairSize}px`} />
    </div>
  );
}

// ── HUD ──

function HudSettings() {
  const showSpeedMeter = useSettingsStore((s) => s.showSpeedMeter);
  const setShowSpeedMeter = useSettingsStore((s) => s.setShowSpeedMeter);
  const showTimer = useSettingsStore((s) => s.showTimer);
  const setShowTimer = useSettingsStore((s) => s.setShowTimer);
  const showCheckpoints = useSettingsStore((s) => s.showCheckpoints);
  const setShowCheckpoints = useSettingsStore((s) => s.setShowCheckpoints);
  const showTrackProgress = useSettingsStore((s) => s.showTrackProgress);
  const setShowTrackProgress = useSettingsStore((s) => s.setShowTrackProgress);
  const hudScale = useSettingsStore((s) => s.hudScale);
  const setHudScale = useSettingsStore((s) => s.setHudScale);
  const hudOpacity = useSettingsStore((s) => s.hudOpacity);
  const setHudOpacity = useSettingsStore((s) => s.setHudOpacity);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold mb-4">HUD</h2>
      <SliderSetting label="Scale" value={hudScale} min={0.5} max={2.0} step={0.1} onChange={setHudScale} displayValue={`${Math.round(hudScale * 100)}%`} />
      <SliderSetting label="Opacity" value={hudOpacity} min={0.1} max={1.0} step={0.05} onChange={setHudOpacity} displayValue={`${Math.round(hudOpacity * 100)}%`} />

      <h3 className="text-sm text-gray-400 uppercase tracking-wider mt-6 mb-2">Elements</h3>
      <ToggleSetting label="Speed Meter" value={showSpeedMeter} onChange={setShowSpeedMeter} />
      <ToggleSetting label="Timer" value={showTimer} onChange={setShowTimer} />
      <ToggleSetting label="Checkpoints" value={showCheckpoints} onChange={setShowCheckpoints} />
      <ToggleSetting label="Track Progress" value={showTrackProgress} onChange={setShowTrackProgress} />
    </div>
  );
}

// ── Key Binds ──

function KeyBindSettings() {
  const keyBindings = useSettingsStore((s) => s.keyBindings);
  const setKeyBinding = useSettingsStore((s) => s.setKeyBinding);
  const resetKeyBindings = useSettingsStore((s) => s.resetKeyBindings);
  const [rebinding, setRebinding] = useState<string | null>(null);

  const handleRebind = (action: string) => {
    setRebinding(action);

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      setKeyBinding(action, e.code);
      setRebinding(null);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setKeyBinding(action, `Mouse${e.button}`);
      setRebinding(null);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Key Bindings</h2>
        <button
          onClick={resetKeyBindings}
          className="text-sm text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
        >
          Reset Defaults
        </button>
      </div>

      {Object.entries(DEFAULT_KEY_BINDINGS).map(([action]) => (
        <div key={action} className="flex items-center justify-between py-1.5 border-b border-gray-800">
          <span className="text-gray-300 capitalize">{formatActionName(action)}</span>
          <button
            onClick={() => handleRebind(action)}
            className={`px-3 py-1 rounded font-mono text-sm min-w-[100px] text-center transition-colors cursor-pointer ${
              rebinding === action
                ? 'bg-yellow-600 text-white animate-pulse'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {rebinding === action ? 'Press key...' : formatKeyName(keyBindings[action])}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Shared components ──

function SliderSetting({ label, value, min, max, step, onChange, displayValue }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; displayValue: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-300 w-28 flex-shrink-0">{label}</span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-green-500"
      />
      <span className="text-gray-400 font-mono w-16 text-right text-sm">{displayValue}</span>
    </div>
  );
}

function ToggleSetting({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span className="text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${value ? 'bg-green-500' : 'bg-gray-700'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${value ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

function SelectSetting({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-300 w-28 flex-shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function ColorSetting({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-300 w-28 flex-shrink-0">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-6 rounded border border-gray-700 cursor-pointer bg-transparent"
      />
      <span className="text-gray-500 font-mono text-sm">{value}</span>
    </div>
  );
}

function formatActionName(action: string): string {
  return action.replace(/([A-Z])/g, ' $1').trim();
}

function formatKeyName(key: string): string {
  if (key.startsWith('Key')) return key.slice(3);
  if (key.startsWith('Mouse')) return `Mouse ${key.slice(5)}`;
  if (key === 'Space') return 'Space';
  return key.replace(/([A-Z])/g, ' $1').trim();
}
