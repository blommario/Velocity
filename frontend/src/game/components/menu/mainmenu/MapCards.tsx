/**
 * Map card components for the main menu — official/community cards, stat
 * badges, tab buttons, and empty/loading states.
 *
 * Depends on: menuConfig (styles + formatTime), OfficialMap type, MapResponse type
 * Used by: MainMenu
 */
import type { OfficialMap } from '../../game/map/official';
import type { MapResponse } from '@game/services/types';
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_BADGE,
  DIFFICULTY_ACCENT,
  DIFFICULTY_HOVER,
  MAP_ICONS,
  formatTime,
} from './menuConfig';

export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function OfficialMapCard({ map, onPlay }: { map: OfficialMap; onPlay: () => void }) {
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

export function CommunityMapCard({ map, onPlay }: { map: MapResponse; onPlay: () => void }) {
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

export function EmptyState({ text }: { text: string }) {
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

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
      <p className="text-gray-600 text-xs font-mono tracking-wide">Loading maps...</p>
    </div>
  );
}
