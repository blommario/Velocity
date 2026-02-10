/**
 * Main menu screen — map selection (official + community tabs), navigation,
 * and header with user status. Orchestrates sub-components from mainmenu/.
 *
 * Depends on: gameStore, mapService, MainMenu sub-modules
 * Used by: App (screen router)
 */
import { useEffect, useState } from 'react';
import { useGameStore } from '@game/stores/gameStore';
import { getMaps } from '@game/services/mapService';
import type { MapResponse, MapDifficulty } from '@game/services/types';
import { OFFICIAL_MAPS, OFFICIAL_MAP_BY_ID, type OfficialMap } from '../game/map/official';
import type { MapData } from '../game/map/types';
import { DIFFICULTY_OPTIONS, NAV_ITEMS } from './mainmenu/menuConfig';
import { MenuHeader } from './mainmenu/MenuHeader';
import { TabButton, OfficialMapCard, CommunityMapCard, EmptyState, LoadingState } from './mainmenu/MapCards';

export function MainMenu() {
  const loadMap = useGameStore((s) => s.loadMap);
  const playTestMap = useGameStore((s) => s.playTestMap);

  const [communityMaps, setCommunityMaps] = useState<MapResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MapDifficulty | 'All'>('All');
  const [tab, setTab] = useState<'official' | 'community'>('official');

  useEffect(() => {
    if (tab !== 'community') return;
    setLoading(true);
    getMaps({ difficulty: filter === 'All' ? undefined : filter })
      .then(setCommunityMaps)
      .catch(() => setCommunityMaps([]))
      .finally(() => setLoading(false));
  }, [filter, tab]);

  const filteredOfficialMaps = filter === 'All'
    ? OFFICIAL_MAPS
    : OFFICIAL_MAPS.filter((m) => m.difficulty === filter);

  const handlePlayOfficial = (map: OfficialMap) => loadMap(map.id, map.data);

  const handlePlayCommunity = (map: MapResponse) => {
    const official = OFFICIAL_MAP_BY_ID[map.id];
    if (official) { loadMap(map.id, official.data); return; }
    try {
      const data = JSON.parse(map.mapDataJson) as MapData;
      if (data.spawnPoint && data.blocks && data.finish) { loadMap(map.id, data); return; }
    } catch { /* fall through */ }
    playTestMap();
  };

  const handleNavClick = (item: typeof NAV_ITEMS[number]) => {
    if (item.screen === null) playTestMap();
    else useGameStore.getState().setScreen(item.screen);
  };

  return (
    <div className="w-screen h-screen bg-[#06060c] text-white flex flex-col overflow-hidden relative">
      <div className="stars-small" /><div className="stars-medium" /><div className="stars-large" />
      <div className="nebula" style={{ top: '15%', left: '10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)' }} />
      <div className="nebula" style={{ bottom: '10%', right: '5%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', animationDelay: '8s' }} />
      <div className="nebula" style={{ top: '50%', left: '55%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)', animationDelay: '15s' }} />
      <div className="shooting-star" style={{ top: '12%' }} />
      <div className="shooting-star" style={{ top: '35%', animationDelay: '5s' }} />
      <div className="shooting-star" style={{ top: '65%', animationDelay: '12s' }} />

      <MenuHeader onNavClick={handleNavClick} />

      {/* Tabs + Filters */}
      <div className="relative z-10 px-8 flex gap-1 items-center border-b border-white/[0.06]">
        <TabButton active={tab === 'official'} onClick={() => setTab('official')}>Official Maps</TabButton>
        <TabButton active={tab === 'community'} onClick={() => setTab('community')}>Community</TabButton>
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

      {/* Map grid */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 py-6 scrollbar-thin">
        {tab === 'official' ? (
          filteredOfficialMaps.length === 0 ? <EmptyState text="No maps match filter" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl">
              {filteredOfficialMaps.map((map) => (
                <OfficialMapCard key={map.id} map={map} onPlay={() => handlePlayOfficial(map)} />
              ))}
            </div>
          )
        ) : loading ? <LoadingState /> : communityMaps.length === 0 ? <EmptyState text="No community maps found" /> : (
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
