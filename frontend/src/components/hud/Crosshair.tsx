import { useCombatStore } from '../../stores/combatStore';
import type { WeaponType } from '../game/physics/types';

/** Crosshair style per weapon type */
const CROSSHAIR_CONFIG: Record<WeaponType, { type: 'dot' | 'cross' | 'ring' | 'scope'; size: number; color: string }> = {
  knife:   { type: 'dot',   size: 2,  color: 'rgba(255,255,255,0.5)' },
  assault: { type: 'cross', size: 12, color: 'rgba(96,165,250,0.8)' },
  shotgun: { type: 'ring',  size: 24, color: 'rgba(245,158,11,0.6)' },
  rocket:  { type: 'cross', size: 10, color: 'rgba(239,68,68,0.8)' },
  grenade: { type: 'cross', size: 10, color: 'rgba(34,197,94,0.8)' },
  sniper:  { type: 'scope', size: 40, color: 'rgba(167,139,250,0.7)' },
  plasma:  { type: 'ring',  size: 16, color: 'rgba(6,182,212,0.7)' },
} as const;

export function Crosshair() {
  const weapon = useCombatStore((s) => s.activeWeapon);
  const isZoomed = useCombatStore((s) => s.isZoomed);
  const config = CROSSHAIR_CONFIG[weapon];

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {config.type === 'dot' && <DotCrosshair size={config.size} color={config.color} />}
      {config.type === 'cross' && <CrossCrosshair size={config.size} color={config.color} />}
      {config.type === 'ring' && <RingCrosshair size={config.size} color={config.color} />}
      {config.type === 'scope' && (isZoomed
        ? <ScopeCrosshair size={config.size * 3} color={config.color} />
        : <CrossCrosshair size={config.size / 3} color={config.color} />
      )}
    </div>
  );
}

function DotCrosshair({ size, color }: { size: number; color: string }) {
  return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: '50%' }} />;
}

function CrossCrosshair({ size, color }: { size: number; color: string }) {
  const gap = 3;
  const thickness = 2;
  const arm = (size - gap) / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Center dot */}
      <div className="absolute" style={{ left: size / 2 - 1, top: size / 2 - 1, width: 2, height: 2, backgroundColor: color }} />
      {/* Top */}
      <div className="absolute" style={{ left: size / 2 - thickness / 2, top: 0, width: thickness, height: arm, backgroundColor: color }} />
      {/* Bottom */}
      <div className="absolute" style={{ left: size / 2 - thickness / 2, bottom: 0, width: thickness, height: arm, backgroundColor: color }} />
      {/* Left */}
      <div className="absolute" style={{ top: size / 2 - thickness / 2, left: 0, width: arm, height: thickness, backgroundColor: color }} />
      {/* Right */}
      <div className="absolute" style={{ top: size / 2 - thickness / 2, right: 0, width: arm, height: thickness, backgroundColor: color }} />
    </div>
  );
}

function RingCrosshair({ size, color }: { size: number; color: string }) {
  return (
    <div
      style={{
        width: size, height: size,
        border: `2px solid ${color}`,
        borderRadius: '50%',
      }}
    >
      {/* Center dot */}
      <div
        className="absolute"
        style={{
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 2, height: 2,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function ScopeCrosshair({ size, color }: { size: number; color: string }) {
  const thickness = 1;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer circle */}
      <div
        className="absolute inset-0"
        style={{ border: `1px solid ${color}`, borderRadius: '50%' }}
      />
      {/* Horizontal line */}
      <div
        className="absolute"
        style={{ top: size / 2 - thickness / 2, left: 0, right: 0, height: thickness, backgroundColor: color }}
      />
      {/* Vertical line */}
      <div
        className="absolute"
        style={{ left: size / 2 - thickness / 2, top: 0, bottom: 0, width: thickness, backgroundColor: color }}
      />
      {/* Center dot */}
      <div
        className="absolute"
        style={{
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 3, height: 3,
          backgroundColor: color,
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
