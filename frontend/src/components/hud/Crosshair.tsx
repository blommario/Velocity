import { useCombatStore } from '../../stores/combatStore';
import { useSettingsStore, CROSSHAIR_STYLES, type CrosshairStyle } from '../../stores/settingsStore';
import type { WeaponType } from '../game/physics/types';

/** Default crosshair style per weapon type */
const WEAPON_CROSSHAIR: Record<WeaponType, { type: 'dot' | 'cross' | 'ring' | 'scope'; size: number; color: string }> = {
  knife:   { type: 'dot',   size: 2,  color: 'rgba(255,255,255,0.5)' },
  assault: { type: 'cross', size: 12, color: 'rgba(96,165,250,0.8)' },
  shotgun: { type: 'ring',  size: 24, color: 'rgba(245,158,11,0.6)' },
  rocket:  { type: 'cross', size: 10, color: 'rgba(239,68,68,0.8)' },
  grenade: { type: 'cross', size: 10, color: 'rgba(34,197,94,0.8)' },
  sniper:  { type: 'scope', size: 40, color: 'rgba(167,139,250,0.7)' },
  plasma:  { type: 'ring',  size: 16, color: 'rgba(6,182,212,0.7)' },
} as const;

/** Map settings crosshair style to render type */
function resolveStyle(
  settingsStyle: CrosshairStyle,
  weaponType: 'dot' | 'cross' | 'ring' | 'scope',
): 'dot' | 'cross' | 'ring' | 'scope' {
  if (settingsStyle === CROSSHAIR_STYLES.NONE) return weaponType;
  if (settingsStyle === CROSSHAIR_STYLES.DOT) return 'dot';
  if (settingsStyle === CROSSHAIR_STYLES.CROSS) return 'cross';
  if (settingsStyle === CROSSHAIR_STYLES.CIRCLE) return 'ring';
  return weaponType;
}

/** Convert hex color + opacity to rgba */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function Crosshair() {
  const weapon = useCombatStore((s) => s.activeWeapon);
  const isZoomed = useCombatStore((s) => s.isZoomed);
  const crosshairStyle = useSettingsStore((s) => s.crosshairStyle);
  const crosshairColor = useSettingsStore((s) => s.crosshairColor);
  const crosshairSize = useSettingsStore((s) => s.crosshairSize);

  if (crosshairStyle === CROSSHAIR_STYLES.NONE) return null;

  const weaponConfig = WEAPON_CROSSHAIR[weapon];

  // Use custom settings if set, otherwise weapon defaults
  const useCustom = crosshairStyle !== CROSSHAIR_STYLES.DOT || crosshairColor !== '#ffffff' || crosshairSize !== 4;
  const type = useCustom ? resolveStyle(crosshairStyle, weaponConfig.type) : weaponConfig.type;
  const size = useCustom ? crosshairSize * 3 : weaponConfig.size;
  const color = useCustom ? hexToRgba(crosshairColor, 0.8) : weaponConfig.color;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {type === 'dot' && <DotCrosshair size={size} color={color} />}
      {type === 'cross' && <CrossCrosshair size={size} color={color} />}
      {type === 'ring' && <RingCrosshair size={size} color={color} />}
      {type === 'scope' && (isZoomed
        ? <ScopeCrosshair size={size * 3} color={color} />
        : <CrossCrosshair size={size / 3} color={color} />
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
