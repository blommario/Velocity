import { useEffect, useState } from 'react';
import { useGameStore, SCREENS } from '@game/stores/gameStore';
import { useAuthStore } from '@game/stores/authStore';
import { getMaps } from '@game/services/mapService';
import type { MapResponse, MapDifficulty } from '@game/services/types';
import { OFFICIAL_MAPS, OFFICIAL_MAP_BY_ID, type OfficialMap } from '../game/map/official';
import type { MapData } from '../game/map/types';
import { SystemStatus } from './SystemStatus';

const DIFFICULTY_COLORS: Record<MapDifficulty, string> = {
  Easy: 'text-emerald-400',
  Medium: 'text-amber-400',
  Hard: 'text-orange-400',
  Expert: 'text-rose-400',
} as const;

const DIFFICULTY_BADGE: Record<MapDifficulty, string> = {
  Easy: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10',
  Medium: 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10',
  Hard: 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-orange-500/10',
  Expert: 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/10',
} as const;

const DIFFICULTY_ACCENT: Record<MapDifficulty, string> = {
  Easy: 'from-emerald-400/60 via-emerald-400/20 to-transparent',
  Medium: 'from-amber-400/60 via-amber-400/20 to-transparent',
  Hard: 'from-orange-400/60 via-orange-400/20 to-transparent',
  Expert: 'from-rose-400/60 via-rose-400/20 to-transparent',
} as const;

const DIFFICULTY_HOVER: Record<MapDifficulty, string> = {
  Easy: 'hover:border-emerald-500/30 hover:shadow-emerald-500/10',
  Medium: 'hover:border-amber-500/30 hover:shadow-amber-500/10',
  Hard: 'hover:border-orange-500/30 hover:shadow-orange-500/10',
  Expert: 'hover:border-rose-500/30 hover:shadow-rose-500/10',
} as const;

const MAP_ICONS: Record<string, string> = {
  'first-steps': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  'showcase': 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
} as const;

const DIFFICULTY_OPTIONS: (MapDifficulty | 'All')[] = ['All', 'Easy', 'Medium', 'Hard', 'Expert'];

const NAV_ITEMS = [
  { label: 'QUICK PLAY', icon: 'M5 3l14 9-14 9V3z', screen: null, accent: 'cyan' },
  { label: 'MAP EDITOR', icon: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', screen: SCREENS.MAP_EDITOR, accent: 'violet' },
  { label: 'LIVE RACE', icon: 'M13 10V3L4 14h7v7l9-11h-7z', screen: SCREENS.RACE_LOBBY, accent: 'blue' },
  { label: 'PROFILE', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', screen: SCREENS.PROFILE, accent: 'gray' },
  { label: 'SETTINGS', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', screen: SCREENS.SETTINGS, accent: 'gray' },
] as const;

const NAV_ACCENT_STYLES: Record<string, string> = {
  cyan: 'border-cyan-500/40 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:shadow-cyan-500/20 text-cyan-400',
  violet: 'border-violet-500/40 hover:border-violet-400/60 hover:bg-violet-500/10 hover:shadow-violet-500/20 text-violet-400',
  blue: 'border-blue-500/40 hover:border-blue-400/60 hover:bg-blue-500/10 hover:shadow-blue-500/20 text-blue-400',
  gray: 'border-white/10 hover:border-white/20 hover:bg-white/5 hover:shadow-white/5 text-gray-400',
} as const;

export function MainMenu() {
  const loadMap = useGameStore((s) => s.loadMap);
  const playTestMap = useGameStore((s) => s.playTestMap);
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);

  const [communityMaps, setCommunityMaps] = useState<MapResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MapDifficulty | 'All'>('All');
  const [tab, setTab] = useState<'official' | 'community'>('official');

  useEffect(() => {
    if (tab !== 'community') return;
    setLoading(true);
    getMaps({
      difficulty: filter === 'All' ? undefined : filter,
    })
      .then(setCommunityMaps)
      .catch(() => setCommunityMaps([]))
      .finally(() => setLoading(false));
  }, [filter, tab]);

  const filteredOfficialMaps = filter === 'All'
    ? OFFICIAL_MAPS
    : OFFICIAL_MAPS.filter((m) => m.difficulty === filter);

  const handlePlayOfficial = (map: OfficialMap) => {
    loadMap(map.id, map.data);
  };

  const handlePlayCommunity = (map: MapResponse) => {
    const official = OFFICIAL_MAP_BY_ID[map.id];
    if (official) {
      loadMap(map.id, official.data);
      return;
    }

    try {
      const data = JSON.parse(map.mapDataJson) as MapData;
      if (data.spawnPoint && data.blocks && data.finish) {
        loadMap(map.id, data);
        return;
      }
    } catch {
      // Invalid JSON — fall through to test map
    }

    playTestMap();
  };

  const handleNavClick = (item: typeof NAV_ITEMS[number]) => {
    if (item.screen === null) {
      playTestMap();
    } else {
      useGameStore.getState().setScreen(item.screen);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#06060c] text-white flex flex-col overflow-hidden relative">
      {/* Star field */}
      <div className="stars-small" />
      <div className="stars-medium" />
      <div className="stars-large" />

      {/* Nebula clouds */}
      <div
        className="nebula"
        style={{ top: '15%', left: '10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)' }}
      />
      <div
        className="nebula"
        style={{ bottom: '10%', right: '5%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', animationDelay: '8s' }}
      />
      <div
        className="nebula"
        style={{ top: '50%', left: '55%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)', animationDelay: '15s' }}
      />

      {/* Shooting stars */}
      <div className="shooting-star" style={{ top: '12%' }} />
      <div className="shooting-star" style={{ top: '35%', animationDelay: '5s' }} />
      <div className="shooting-star" style={{ top: '65%', animationDelay: '12s' }} />

      {/* Header */}
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

      {/* Navigation */}
      <nav className="relative z-10 px-8 py-4 flex gap-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => handleNavClick(item)}
            className={`group flex items-center gap-2.5 bg-transparent border rounded-lg py-2.5 px-5 text-xs font-bold tracking-[0.15em] uppercase transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 ${NAV_ACCENT_STYLES[item.accent]}`}
          >
            <svg className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Tabs + Filters */}
      <div className="relative z-10 px-8 flex gap-1 items-center border-b border-white/[0.06]">
        <TabButton active={tab === 'official'} onClick={() => setTab('official')}>
          Official Maps
        </TabButton>
        <TabButton active={tab === 'community'} onClick={() => setTab('community')}>
          Community
        </TabButton>

        <div className="flex gap-1 ml-auto pb-2">
          {DIFFICULTY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={`px-3.5 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${
                filter === d
                  ? 'bg-white/[0.08] text-white border border-white/10 shadow-inner'
                  : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Content area — map grid */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 py-6 scrollbar-thin">
        {tab === 'official' ? (
          filteredOfficialMaps.length === 0 ? (
            <EmptyState text="No maps match filter" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl">
              {filteredOfficialMaps.map((map) => (
                <OfficialMapCard key={map.id} map={map} onPlay={() => handlePlayOfficial(map)} />
              ))}
            </div>
          )
        ) : loading ? (
          <LoadingState />
        ) : communityMaps.length === 0 ? (
          <EmptyState text="No community maps found" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl">
            {communityMaps.map((map) => (
              <CommunityMapCard key={map.id} map={map} onPlay={() => handlePlayCommunity(map)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] transition-colors ${
        active ? 'text-white' : 'text-gray-600 hover:text-gray-400'
      }`}
    >
      {children}
      {active && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 rounded-full shadow-sm shadow-cyan-400/30" />
      )}
    </button>
  );
}

function OfficialMapCard({ map, onPlay }: { map: OfficialMap; onPlay: () => void }) {
  const iconPath = MAP_ICONS[map.id];

  return (
    <div
      className={`group relative bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl ${DIFFICULTY_HOVER[map.difficulty]} cursor-pointer backdrop-blur-sm`}
      onClick={onPlay}
    >
      <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r ${DIFFICULTY_ACCENT[map.difficulty]}`} />

      <div className="relative px-5 pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {iconPath && (
              <div className={`relative w-10 h-10 rounded-lg flex items-center justify-center ${
                map.difficulty === 'Easy' ? 'bg-emerald-500/10' :
                map.difficulty === 'Medium' ? 'bg-amber-500/10' :
                map.difficulty === 'Hard' ? 'bg-orange-500/10' :
                'bg-rose-500/10'
              }`}>
                <svg className={`w-5 h-5 ${DIFFICULTY_COLORS[map.difficulty]}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={iconPath} />
                </svg>
              </div>
            )}
            <div>
              <h3 className="font-bold text-sm text-white/90 group-hover:text-white transition-colors">
                {map.name}
              </h3>
              <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[9px] font-bold uppercase tracking-widest border shadow-sm ${DIFFICULTY_BADGE[map.difficulty]}`}>
                {map.difficulty}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-3">
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{map.description}</p>
      </div>

      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] text-gray-600 font-mono tracking-wide">PAR {formatTime(map.parTime * 1000)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-all duration-300">
          <span className={DIFFICULTY_COLORS[map.difficulty]}>Play</span>
          <svg className={`w-3 h-3 ${DIFFICULTY_COLORS[map.difficulty]} transition-transform group-hover:translate-x-0.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}

function CommunityMapCard({ map, onPlay }: { map: MapResponse; onPlay: () => void }) {
  return (
    <div
      className={`group relative bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl ${DIFFICULTY_HOVER[map.difficulty]} cursor-pointer backdrop-blur-sm`}
      onClick={onPlay}
    >
      <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r ${DIFFICULTY_ACCENT[map.difficulty]}`} />

      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-sm text-white/90 group-hover:text-white transition-colors">
              {map.name}
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[9px] font-bold uppercase tracking-widest border shadow-sm ${DIFFICULTY_BADGE[map.difficulty]}`}>
              {map.difficulty}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-700 uppercase tracking-widest font-mono">by</div>
            <div className="text-xs text-gray-500 font-medium">{map.authorName}</div>
          </div>
        </div>
      </div>

      {map.description && (
        <div className="px-5 pb-3">
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{map.description}</p>
        </div>
      )}

      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Stat icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" value={`${map.playCount}`} />
          <Stat icon="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" value={`${map.likeCount}`} />
          {map.worldRecordTime && (
            <Stat icon="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" value={formatTime(map.worldRecordTime * 1000)} />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-all duration-300">
          <span className={DIFFICULTY_COLORS[map.difficulty]}>Play</span>
          <svg className={`w-3 h-3 ${DIFFICULTY_COLORS[map.difficulty]} transition-transform group-hover:translate-x-0.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}

function Stat({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      <span className="text-[10px] text-gray-600 font-mono">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-gray-600 text-xs font-mono tracking-wide">{text}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
      <p className="text-gray-600 text-xs font-mono tracking-wide">Loading maps...</p>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
