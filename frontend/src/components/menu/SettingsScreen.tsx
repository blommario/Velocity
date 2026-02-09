import { useState, useEffect } from 'react';
import { useGameStore, SCREENS } from '../../stores/gameStore';
import {
  useSettingsStore,
  CROSSHAIR_STYLES, QUALITY_PRESETS,
  DEFAULT_KEY_BINDINGS,
  type CrosshairStyle, type QualityPreset,
} from '../../stores/settingsStore';
import { SHADOW_QUALITY_LEVELS, type ShadowQuality } from '../../engine/rendering/shadowConfig';

const SETTINGS_TABS = {
  MOUSE: 'mouse',
  VIDEO: 'video',
  AUDIO: 'audio',
  GAMEPLAY: 'gameplay',
  HUD: 'hud',
  KEYBINDS: 'keybinds',
} as const;

type SettingsTab = (typeof SETTINGS_TABS)[keyof typeof SETTINGS_TABS];

const TAB_LABELS: { tab: SettingsTab; label: string; icon: string }[] = [
  { tab: SETTINGS_TABS.MOUSE, label: 'Mouse', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5' },
  { tab: SETTINGS_TABS.VIDEO, label: 'Video', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { tab: SETTINGS_TABS.AUDIO, label: 'Audio', icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z' },
  { tab: SETTINGS_TABS.GAMEPLAY, label: 'Gameplay', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  { tab: SETTINGS_TABS.HUD, label: 'HUD', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { tab: SETTINGS_TABS.KEYBINDS, label: 'Key Binds', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
];

export function SettingsScreen() {
  const [tab, setTab] = useState<SettingsTab>(SETTINGS_TABS.MOUSE);
  const setScreen = useGameStore((s) => s.setScreen);
  const resetAll = useSettingsStore((s) => s.resetAll);

  return (
    <div className="w-screen h-screen bg-[#06060c] text-white flex flex-col relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-32 right-1/4 w-[400px] h-[400px] bg-violet-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-cyan-500/[0.02] rounded-full blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/[0.06] backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h1 className="text-lg font-bold tracking-[0.15em] uppercase">Settings</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetAll}
            className="text-[10px] text-gray-600 hover:text-rose-400 transition-colors font-mono uppercase tracking-widest border border-white/[0.06] hover:border-rose-500/30 rounded-lg px-4 py-2 cursor-pointer"
          >
            Reset All
          </button>
          <button
            onClick={() => setScreen(SCREENS.MAIN_MENU)}
            className="text-[10px] text-gray-400 hover:text-white transition-colors font-mono uppercase tracking-widest border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-lg px-4 py-2 cursor-pointer"
          >
            Back
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-52 border-r border-white/[0.06] py-3 flex flex-col gap-0.5 px-2">
          {TAB_LABELS.map(({ tab: t, label, icon }) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-full text-left px-4 py-2.5 text-xs font-bold tracking-[0.1em] uppercase rounded-lg transition-all duration-200 flex items-center gap-3 cursor-pointer ${
                tab === t
                  ? 'bg-white/[0.06] text-white border border-white/[0.08]'
                  : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              <svg className={`w-4 h-4 ${tab === t ? 'text-cyan-400' : 'text-gray-700'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
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
      <SectionTitle>Mouse</SectionTitle>
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
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);
  const setShadowQuality = useSettingsStore((s) => s.setShadowQuality);
  const particles = useSettingsStore((s) => s.particles);
  const setParticles = useSettingsStore((s) => s.setParticles);
  const speedLines = useSettingsStore((s) => s.speedLines);
  const setSpeedLines = useSettingsStore((s) => s.setSpeedLines);
  const screenShake = useSettingsStore((s) => s.screenShake);
  const setScreenShake = useSettingsStore((s) => s.setScreenShake);
  const ssao = useSettingsStore((s) => s.ssao);
  const setSsao = useSettingsStore((s) => s.setSsao);
  const colorGrading = useSettingsStore((s) => s.colorGrading);
  const setColorGrading = useSettingsStore((s) => s.setColorGrading);
  const filmGrain = useSettingsStore((s) => s.filmGrain);
  const setFilmGrain = useSettingsStore((s) => s.setFilmGrain);
  const chromaticAberration = useSettingsStore((s) => s.chromaticAberration);
  const setChromaticAberration = useSettingsStore((s) => s.setChromaticAberration);

  return (
    <div className="space-y-4">
      <SectionTitle>Video</SectionTitle>
      <SliderSetting label="FOV" value={fov} min={80} max={130} step={1} onChange={setFov} displayValue={`${fov}`} />
      <SelectSetting
        label="Quality"
        value={qualityPreset}
        options={Object.values(QUALITY_PRESETS)}
        onChange={(v) => setQualityPreset(v as QualityPreset)}
      />
      <SelectSetting
        label="Shadows"
        value={shadowQuality}
        options={Object.values(SHADOW_QUALITY_LEVELS)}
        onChange={(v) => setShadowQuality(v as ShadowQuality)}
      />
      <ToggleSetting label="Particles" value={particles} onChange={setParticles} />
      <ToggleSetting label="Speed Lines" value={speedLines} onChange={setSpeedLines} />
      <ToggleSetting label="Screen Shake" value={screenShake} onChange={setScreenShake} />

      <div className="pt-4">
        <SubSectionTitle>Post-Processing</SubSectionTitle>
      </div>
      <ToggleSetting label="SSAO" value={ssao} onChange={setSsao} />
      <ToggleSetting label="Color Grading" value={colorGrading} onChange={setColorGrading} />
      <ToggleSetting label="Film Grain" value={filmGrain} onChange={setFilmGrain} />
      <ToggleSetting label="Chromatic Aberration" value={chromaticAberration} onChange={setChromaticAberration} />
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
      <SectionTitle>Audio</SectionTitle>
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
      <SectionTitle>Gameplay</SectionTitle>
      <ToggleSetting label="Auto Bunny Hop" value={autoBhop} onChange={setAutoBhop} />

      <div className="pt-4">
        <SubSectionTitle>Crosshair</SubSectionTitle>
      </div>
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
      <SectionTitle>HUD</SectionTitle>
      <SliderSetting label="Scale" value={hudScale} min={0.5} max={2.0} step={0.1} onChange={setHudScale} displayValue={`${Math.round(hudScale * 100)}%`} />
      <SliderSetting label="Opacity" value={hudOpacity} min={0.1} max={1.0} step={0.05} onChange={setHudOpacity} displayValue={`${Math.round(hudOpacity * 100)}%`} />

      <div className="pt-4">
        <SubSectionTitle>Elements</SubSectionTitle>
      </div>
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

  // Attach listeners via useEffect so they're cleaned up on unmount
  useEffect(() => {
    if (!rebinding) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        setRebinding(null);
        return;
      }
      // Conflict resolution (swap) is handled inside settingsStore.setKeyBinding
      setKeyBinding(rebinding, e.code);
      setRebinding(null);
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setKeyBinding(rebinding, `Mouse${e.button}`);
      setRebinding(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [rebinding, setKeyBinding]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Key Bindings</SectionTitle>
        <button
          onClick={resetKeyBindings}
          className="text-[10px] text-gray-600 hover:text-rose-400 transition-colors font-mono uppercase tracking-widest cursor-pointer"
        >
          Reset Defaults
        </button>
      </div>

      {Object.entries(DEFAULT_KEY_BINDINGS).map(([action]) => (
        <div key={action} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
          <span className="text-gray-400 capitalize text-sm">{formatActionName(action)}</span>
          <button
            onClick={() => setRebinding(action)}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs min-w-[100px] text-center transition-all cursor-pointer ${
              rebinding === action
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 animate-pulse'
                : 'bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.06]'
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-white/80 mb-4">{children}</h2>
  );
}

function SubSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-mono mb-2">{children}</h3>
  );
}

function SliderSetting({ label, value, min, max, step, onChange, displayValue }: {
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

function ToggleSetting({ label, value, onChange }: {
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

function SelectSetting({ label, value, options, onChange }: {
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

function ColorSetting({ label, value, onChange }: {
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

function formatActionName(action: string): string {
  return action.replace(/([A-Z])/g, ' $1').trim();
}

function formatKeyName(key: string): string {
  if (key.startsWith('Key')) return key.slice(3);
  if (key.startsWith('Mouse')) return `Mouse ${key.slice(5)}`;
  if (key === 'Space') return 'Space';
  return key.replace(/([A-Z])/g, ' $1').trim();
}
