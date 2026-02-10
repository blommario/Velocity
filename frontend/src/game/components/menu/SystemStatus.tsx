import { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@game/stores/settingsStore';

interface StatusItem {
  label: string;
  status: 'ok' | 'warn' | 'error' | 'checking';
  detail: string;
}

const STATUS_STYLES = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-rose-500',
  checking: 'bg-gray-500 animate-pulse',
} as const;

const STATUS_TEXT = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-rose-400',
  checking: 'text-gray-400',
} as const;

const hasWebGPU = !!(navigator as Navigator & { gpu?: unknown }).gpu;

export function SystemStatus() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'warn'>('checking');
  const [expanded, setExpanded] = useState(false);

  // Reactive selectors — component re-renders when these change
  const bloom = useSettingsStore((s) => s.bloom);
  const particles = useSettingsStore((s) => s.particles);
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);

  // Backend health check (once on mount)
  useEffect(() => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);

    fetch('/api/health', { method: 'HEAD', signal: ctrl.signal })
      .then((res) => setBackendStatus(res.ok ? 'ok' : 'warn'))
      .catch(() => setBackendStatus('warn'))
      .finally(() => clearTimeout(timeout));

    return () => { ctrl.abort(); clearTimeout(timeout); };
  }, []);

  const shadowsEnabled = shadowQuality !== 'off';

  const items = useMemo<StatusItem[]>(() => [
    {
      label: 'WebGPU',
      status: hasWebGPU ? 'ok' : 'error',
      detail: hasWebGPU ? 'GPU adapter available' : 'Not supported — falling back to WebGL',
    },
    {
      label: 'Bloom',
      status: bloom ? 'ok' : 'warn',
      detail: bloom ? 'PostProcessing pipeline active' : 'Disabled in settings',
    },
    {
      label: 'GPU Particles',
      status: particles ? 'ok' : 'warn',
      detail: particles ? 'Compute shaders enabled' : 'Disabled in settings',
    },
    {
      label: 'Shadows',
      status: shadowsEnabled ? 'ok' : 'warn',
      detail: shadowsEnabled ? `Shadow quality: ${shadowQuality}` : 'Disabled in settings',
    },
    {
      label: 'Physics',
      status: 'ok',
      detail: '128Hz fixed timestep',
    },
    {
      label: 'Backend',
      status: backendStatus === 'checking' ? 'checking' : backendStatus,
      detail: backendStatus === 'ok' ? 'Connected' : 'Offline — singleplayer only',
    },
  ], [bloom, particles, shadowQuality, shadowsEnabled, backendStatus]);

  const okCount = items.filter((i) => i.status === 'ok').length;
  const totalCount = items.length;
  const hasIssues = items.some((i) => i.status === 'error' || i.status === 'warn');

  return (
    <div className="relative">
      {/* Collapsed: compact pill */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
          hasIssues
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'
        }`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${hasIssues ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        <span>{okCount}/{totalCount} Systems</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded: full status panel */}
      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-[#12121a] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-white/5">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">System Status</div>
          </div>
          <div className="p-2">
            {items.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_STYLES[item.status]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-200">{item.label}</div>
                  <div className={`text-[10px] ${STATUS_TEXT[item.status]} truncate`}>{item.detail}</div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-gray-600">Three.js r182 + TSL</span>
            <span className="text-[10px] text-gray-600">Rapier 0.14</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StatusItem['status'] }) {
  const labels = { ok: 'OK', warn: 'WARN', error: 'FAIL', checking: '...' } as const;
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider ${STATUS_TEXT[status]}`}>
      {labels[status]}
    </span>
  );
}
