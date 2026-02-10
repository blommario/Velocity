/**
 * Key binding configuration tab — rebind any action via keyboard/mouse input.
 *
 * Depends on: settingsStore, SettingsWidgets
 * Used by: SettingsScreen
 */
import { useState, useEffect } from 'react';
import { useSettingsStore, DEFAULT_KEY_BINDINGS } from '@game/stores/settingsStore';
import { SectionTitle } from './SettingsWidgets';

export function KeyBindSettings() {
  const keyBindings = useSettingsStore((s) => s.keyBindings);
  const setKeyBinding = useSettingsStore((s) => s.setKeyBinding);
  const resetKeyBindings = useSettingsStore((s) => s.resetKeyBindings);
  const [rebinding, setRebinding] = useState<string | null>(null);

  useEffect(() => {
    if (!rebinding) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        setRebinding(null);
        return;
      }
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

function formatActionName(action: string): string {
  return action.replace(/([A-Z])/g, ' $1').trim();
}

function formatKeyName(key: string | undefined): string {
  if (!key) return '—';
  if (key.startsWith('Key')) return key.slice(3);
  if (key.startsWith('Mouse')) return `Mouse ${key.slice(5)}`;
  if (key === 'Space') return 'Space';
  return key.replace(/([A-Z])/g, ' $1').trim();
}
