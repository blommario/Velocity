import { Crosshair as EngineCrosshair, type CrosshairConfig, type CrosshairType } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';
import { useSettingsStore, CROSSHAIR_STYLES, type CrosshairStyle } from '@game/stores/settingsStore';
import type { WeaponType } from '../game/physics/types';

const WEAPON_CROSSHAIR: Record<WeaponType, { type: CrosshairType; size: number; color: string }> = {
  knife:   { type: 'dot',   size: 2,  color: 'rgba(255,255,255,0.5)' },
  assault: { type: 'cross', size: 12, color: 'rgba(96,165,250,0.8)' },
  shotgun: { type: 'ring',  size: 24, color: 'rgba(245,158,11,0.6)' },
  rocket:  { type: 'cross', size: 10, color: 'rgba(239,68,68,0.8)' },
  grenade: { type: 'cross', size: 10, color: 'rgba(34,197,94,0.8)' },
  sniper:  { type: 'scope', size: 40, color: 'rgba(167,139,250,0.7)' },
  plasma:  { type: 'ring',  size: 16, color: 'rgba(6,182,212,0.7)' },
} as const;

function resolveStyle(settingsStyle: CrosshairStyle, weaponType: CrosshairType): CrosshairType {
  if (settingsStyle === CROSSHAIR_STYLES.NONE) return weaponType;
  if (settingsStyle === CROSSHAIR_STYLES.DOT) return 'dot';
  if (settingsStyle === CROSSHAIR_STYLES.CROSS) return 'cross';
  if (settingsStyle === CROSSHAIR_STYLES.CIRCLE) return 'ring';
  return weaponType;
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function Crosshair() {
  const weapon = useCombatStore((s) => s.activeWeapon);
  const adsProgress = useCombatStore((s) => s.adsProgress);
  const recoilBloom = useCombatStore((s) => s.recoilBloom);
  const crosshairStyle = useSettingsStore((s) => s.crosshairStyle);
  const crosshairColor = useSettingsStore((s) => s.crosshairColor);
  const crosshairSize = useSettingsStore((s) => s.crosshairSize);

  if (crosshairStyle === CROSSHAIR_STYLES.NONE) return null;

  const weaponConfig = WEAPON_CROSSHAIR[weapon];
  const useCustom = crosshairStyle !== CROSSHAIR_STYLES.DOT || crosshairColor !== '#ffffff' || crosshairSize !== 4;

  const config: CrosshairConfig = {
    type: useCustom ? resolveStyle(crosshairStyle, weaponConfig.type) : weaponConfig.type,
    size: useCustom ? crosshairSize * 3 : weaponConfig.size,
    color: useCustom ? hexToRgba(crosshairColor, 0.8) : weaponConfig.color,
  };

  return <EngineCrosshair config={config} showScope={adsProgress > 0.9} opacity={1 - adsProgress} bloom={recoilBloom} />;
}
