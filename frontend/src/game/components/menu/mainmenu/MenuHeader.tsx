/**
 * Main menu header — logo, user status, logout, and navigation bar.
 *
 * Depends on: menuConfig (NAV_ITEMS, NAV_ACCENT_STYLES), SystemStatus, authStore
 * Used by: MainMenu
 */
import { useAuthStore } from '@game/stores/authStore';
import { SystemStatus } from '../SystemStatus';
import { NAV_ITEMS, NAV_ACCENT_STYLES } from './menuConfig';

export function MenuHeader({ onNavClick }: { onNavClick: (item: typeof NAV_ITEMS[number]) => void }) {
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);

  return (
    <>
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/[0.06] backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-400/20 rounded-lg blur-md" />
            <div className="relative w-9 h-9 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M13 7l5 5-5 5M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.25em] bg-gradient-to-r from-white via-cyan-100 to-white/60 bg-clip-text text-transparent leading-none">
              VELOCITY
            </h1>
            <div className="text-[9px] tracking-[0.4em] text-cyan-500/50 font-mono uppercase mt-0.5">
              Speedrun Engine
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SystemStatus />
          <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
            <span className="text-sm text-gray-300 font-medium">{username}</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors font-mono uppercase tracking-wider"
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="relative z-10 px-8 py-4 flex gap-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavClick(item)}
            className={`group flex items-center gap-2.5 bg-transparent border rounded-lg py-2.5 px-5 text-xs font-bold tracking-[0.15em] uppercase transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 ${NAV_ACCENT_STYLES[item.accent]}`}
          >
            <svg className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
