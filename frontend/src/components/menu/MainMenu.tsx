import { useEffect, useState } from 'react';
import { useGameStore, SCREENS } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { getMaps } from '../../services/mapService';
import type { MapResponse, MapDifficulty } from '../../services/types';
import { OFFICIAL_MAPS, OFFICIAL_MAP_BY_ID, type OfficialMap } from '../game/map/official';
import type { MapData } from '../game/map/types';
import { SystemStatus } from './SystemStatus';

const DIFFICULTY_COLORS: Record<MapDifficulty, string> = {
  Easy: 'text-emerald-400',
  Medium: 'text-amber-400',
  Hard: 'text-orange-400',
  Expert: 'text-rose-400',
} as const;

const DIFFICULTY_BG: Record<MapDifficulty, string> = {
  Easy: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  Medium: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  Hard: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
  Expert: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
} as const;

const DIFFICULTY_GLOW: Record<MapDifficulty, string> = {
  Easy: 'hover:shadow-emerald-500/20',
  Medium: 'hover:shadow-amber-500/20',
  Hard: 'hover:shadow-orange-500/20',
  Expert: 'hover:shadow-rose-500/20',
} as const;

const MAP_ICONS: Record<string, string> = {
  'first-steps': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  'cliffside': 'M3 21l6-6 4 4 8-8M17 7h4v4',
  'neon-district': 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  'the-gauntlet': 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  'skybreak': 'M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z',
} as const;

const DIFFICULTY_OPTIONS: (MapDifficulty | 'All')[] = ['All', 'Easy', 'Medium', 'Hard', 'Expert'];

const NAV_ITEMS = [
  { label: 'Quick Play', screen: null, style: 'from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 shadow-cyan-500/25' },
  { label: 'Map Editor', screen: SCREENS.MAP_EDITOR, style: 'from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-violet-500/25' },
  { label: 'Live Race', screen: SCREENS.RACE_LOBBY, style: 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-blue-500/25' },
  { label: 'Profile', screen: SCREENS.PROFILE, style: 'from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-gray-500/25' },
  { label: 'Settings', screen: SCREENS.SETTINGS, style: 'from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-gray-500/25' },
] as const;

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
    <div className="w-screen h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      {/* Animated background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 7l5 5-5 5M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-[0.2em] bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            VELOCITY
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <SystemStatus />
          <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-gray-300 font-medium">{username}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Navigation bar */}
      <div className="relative z-10 px-8 py-4 flex gap-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => handleNavClick(item)}
            className={`bg-gradient-to-b ${item.style} text-white font-semibold py-2.5 px-5 rounded-lg text-sm transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div className="relative z-10 px-8 flex gap-1 items-center border-b border-white/5 pb-0">
        <button
          onClick={() => setTab('official')}
          className={`relative px-5 py-3 text-sm font-bold transition-colors ${
            tab === 'official'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Official Maps
          {tab === 'official' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-violet-400" />
          )}
        </button>
        <button
          onClick={() => setTab('community')}
          className={`relative px-5 py-3 text-sm font-bold transition-colors ${
            tab === 'community'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Community
          {tab === 'community' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-violet-400" />
          )}
        </button>

        {/* Difficulty Filters */}
        <div className="flex gap-1 ml-auto">
          {DIFFICULTY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all duration-200 ${
                filter === d
                  ? 'bg-white/10 text-white shadow-inner backdrop-blur-sm'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Map Grid */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 py-6 scrollbar-thin">
        {tab === 'official' ? (
          filteredOfficialMaps.length === 0 ? (
            <EmptyState text="No maps match filter" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {communityMaps.map((map) => (
              <CommunityMapCard key={map.id} map={map} onPlay={() => handlePlayCommunity(map)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OfficialMapCard({ map, onPlay }: { map: OfficialMap; onPlay: () => void }) {
  const iconPath = MAP_ICONS[map.id];

  return (
    <div
      className={`group relative bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.06] rounded-xl overflow-hidden transition-all duration-300 hover:border-white/15 hover:shadow-2xl ${DIFFICULTY_GLOW[map.difficulty]} cursor-pointer`}
      onClick={onPlay}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${
        map.difficulty === 'Easy' ? 'from-transparent via-emerald-400/50 to-transparent' :
        map.difficulty === 'Medium' ? 'from-transparent via-amber-400/50 to-transparent' :
        map.difficulty === 'Hard' ? 'from-transparent via-orange-400/50 to-transparent' :
        'from-transparent via-rose-400/50 to-transparent'
      }`} />

      {/* Card header with icon */}
      <div className="relative px-5 pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {iconPath && (
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
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
              <h3 className="font-bold text-base text-white group-hover:text-white/90 transition-colors">
                {map.name}
              </h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${DIFFICULTY_BG[map.difficulty]}`}>
                {map.difficulty}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 pb-3">
        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">{map.description}</p>
      </div>

      {/* Stats bar */}
      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs text-gray-500 font-mono">{formatTime(map.parTime * 1000)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span>Play</span>
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 7l5 5-5 5M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}

function CommunityMapCard({ map, onPlay }: { map: MapResponse; onPlay: () => void }) {
  return (
    <div
      className={`group relative bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.06] rounded-xl overflow-hidden transition-all duration-300 hover:border-white/15 hover:shadow-2xl ${DIFFICULTY_GLOW[map.difficulty]} cursor-pointer`}
      onClick={onPlay}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${
        map.difficulty === 'Easy' ? 'from-transparent via-emerald-400/50 to-transparent' :
        map.difficulty === 'Medium' ? 'from-transparent via-amber-400/50 to-transparent' :
        map.difficulty === 'Hard' ? 'from-transparent via-orange-400/50 to-transparent' :
        'from-transparent via-rose-400/50 to-transparent'
      }`} />

      {/* Card header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-base text-white group-hover:text-white/90 transition-colors">
              {map.name}
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${DIFFICULTY_BG[map.difficulty]}`}>
              {map.difficulty}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider">by</div>
            <div className="text-xs text-gray-400 font-medium">{map.authorName}</div>
          </div>
        </div>
      </div>

      {/* Description */}
      {map.description && (
        <div className="px-5 pb-3">
          <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">{map.description}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Stat icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" value={`${map.playCount}`} />
          <Stat icon="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" value={`${map.likeCount}`} />
          {map.worldRecordTime && (
            <Stat icon="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" value={formatTime(map.worldRecordTime * 1000)} />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span>Play</span>
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 7l5 5-5 5M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}

function Stat({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      <span className="text-xs text-gray-500 font-mono">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-gray-500 text-sm">{text}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
      <p className="text-gray-500 text-sm">Loading maps...</p>
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
