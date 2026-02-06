import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { getMaps } from '../../services/mapService';
import type { MapResponse, MapDifficulty } from '../../services/types';
import { OFFICIAL_MAPS, OFFICIAL_MAP_BY_ID, type OfficialMap } from '../game/map/official';
import type { MapData } from '../game/map/types';

const DIFFICULTY_COLORS: Record<MapDifficulty, string> = {
  Easy: 'text-green-400',
  Medium: 'text-yellow-400',
  Hard: 'text-orange-400',
  Expert: 'text-red-400',
} as const;

const DIFFICULTY_OPTIONS: (MapDifficulty | 'All')[] = ['All', 'Easy', 'Medium', 'Hard', 'Expert'];

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
    // Try to match an official map by ID (for seeded data)
    const official = OFFICIAL_MAP_BY_ID[map.id];
    if (official) {
      loadMap(map.id, official.data);
      return;
    }

    // Try to parse mapDataJson from backend
    try {
      const data = JSON.parse(map.mapDataJson) as MapData;
      if (data.spawnPoint && data.blocks && data.finish) {
        loadMap(map.id, data);
        return;
      }
    } catch {
      // Invalid JSON — fall through to test map
    }

    // Fallback: play test map
    playTestMap();
  };

  return (
    <div className="w-screen h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <h1 className="text-3xl font-bold tracking-wider">VELOCITY</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{username}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Quick Play */}
      <div className="px-8 py-4">
        <button
          onClick={playTestMap}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg text-sm transition-colors"
        >
          Quick Play (Sandbox)
        </button>
      </div>

      {/* Tabs */}
      <div className="px-8 flex gap-4 items-center border-b border-gray-800 pb-3">
        <button
          onClick={() => setTab('official')}
          className={`text-sm font-bold transition-colors ${
            tab === 'official' ? 'text-white border-b-2 border-green-500 pb-1' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Official Maps
        </button>
        <button
          onClick={() => setTab('community')}
          className={`text-sm font-bold transition-colors ${
            tab === 'community' ? 'text-white border-b-2 border-green-500 pb-1' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Community
        </button>

        {/* Filters */}
        <div className="flex gap-2 ml-auto">
          {DIFFICULTY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                filter === d
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Map List */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {tab === 'official' ? (
          filteredOfficialMaps.length === 0 ? (
            <div className="text-gray-500 text-center py-12">No maps match filter</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOfficialMaps.map((map) => (
                <OfficialMapCard key={map.id} map={map} onPlay={() => handlePlayOfficial(map)} />
              ))}
            </div>
          )
        ) : loading ? (
          <div className="text-gray-500 text-center py-12">Loading maps...</div>
        ) : communityMaps.length === 0 ? (
          <div className="text-gray-500 text-center py-12">No community maps found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg">{map.name}</h3>
        <span className={`text-xs font-bold ${DIFFICULTY_COLORS[map.difficulty]}`}>
          {map.difficulty}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{map.description}</p>
      <div className="text-xs text-gray-500 mb-3 font-mono">
        Par: {formatTime(map.parTime * 1000)}
      </div>
      <button
        onClick={onPlay}
        className="w-full bg-green-600/80 hover:bg-green-500 text-white font-bold py-2 rounded transition-colors text-sm"
      >
        Play
      </button>
    </div>
  );
}

function CommunityMapCard({ map, onPlay }: { map: MapResponse; onPlay: () => void }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg">{map.name}</h3>
        <span className={`text-xs font-bold ${DIFFICULTY_COLORS[map.difficulty]}`}>
          {map.difficulty}
        </span>
      </div>
      {map.description && (
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{map.description}</p>
      )}
      <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
        <span>by {map.authorName}</span>
        <div className="flex gap-3">
          <span>{map.playCount} plays</span>
          <span>{map.likeCount} likes</span>
        </div>
      </div>
      {map.worldRecordTime && (
        <div className="text-xs text-gray-500 mb-3 font-mono">
          WR: {formatTime(map.worldRecordTime * 1000)}
        </div>
      )}
      <button
        onClick={onPlay}
        className="w-full bg-green-600/80 hover:bg-green-500 text-white font-bold py-2 rounded transition-colors text-sm"
      >
        Play
      </button>
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
