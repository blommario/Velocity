/**
 * Settings screen — tabbed layout with sidebar navigation. Each settings
 * category is rendered by a dedicated tab component in settings/.
 *
 * Depends on: gameStore (screen navigation), settingsStore (resetAll)
 * Used by: App (screen routing)
 */
import { useState } from 'react';
import { useGameStore, SCREENS } from '@game/stores/gameStore';
import { useSettingsStore } from '@game/stores/settingsStore';
import { MouseSettings } from './settings/MouseSettings';
import { VideoSettings } from './settings/VideoSettings';
import { AudioSettings } from './settings/AudioSettings';
import { GameplaySettings } from './settings/GameplaySettings';
import { CameraSettings } from './settings/CameraSettings';
import { HudSettings } from './settings/HudSettings';
import { KeyBindSettings } from './settings/KeyBindSettings';

const SETTINGS_TABS = {
  MOUSE: 'mouse',
  VIDEO: 'video',
  AUDIO: 'audio',
  GAMEPLAY: 'gameplay',
  CAMERA: 'camera',
  HUD: 'hud',
  KEYBINDS: 'keybinds',
} as const;

type SettingsTab = (typeof SETTINGS_TABS)[keyof typeof SETTINGS_TABS];

const TAB_LABELS: { tab: SettingsTab; label: string; icon: string }[] = [
  { tab: SETTINGS_TABS.MOUSE, label: 'Mouse', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5' },
  { tab: SETTINGS_TABS.VIDEO, label: 'Video', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { tab: SETTINGS_TABS.AUDIO, label: 'Audio', icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z' },
  { tab: SETTINGS_TABS.GAMEPLAY, label: 'Gameplay', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  { tab: SETTINGS_TABS.CAMERA, label: 'Camera', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
  { tab: SETTINGS_TABS.HUD, label: 'HUD', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { tab: SETTINGS_TABS.KEYBINDS, label: 'Key Binds', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
];

const TAB_COMPONENTS: Record<SettingsTab, React.FC> = {
  [SETTINGS_TABS.MOUSE]: MouseSettings,
  [SETTINGS_TABS.VIDEO]: VideoSettings,
  [SETTINGS_TABS.AUDIO]: AudioSettings,
  [SETTINGS_TABS.GAMEPLAY]: GameplaySettings,
  [SETTINGS_TABS.CAMERA]: CameraSettings,
  [SETTINGS_TABS.HUD]: HudSettings,
  [SETTINGS_TABS.KEYBINDS]: KeyBindSettings,
};

export function SettingsScreen() {
  const [tab, setTab] = useState<SettingsTab>(SETTINGS_TABS.MOUSE);
  const setScreen = useGameStore((s) => s.setScreen);
  const resetAll = useSettingsStore((s) => s.resetAll);
  const TabContent = TAB_COMPONENTS[tab];

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
          <TabContent />
        </div>
      </div>
    </div>
  );
}
