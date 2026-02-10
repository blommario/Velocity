import { create } from 'zustand';
import { PHYSICS, RELOAD_CONFIG } from '@game/components/game/physics/constants';
import type { WeaponType } from '@game/components/game/physics/types';
import { WEAPON_SLOTS } from '@game/components/game/physics/types';

// Internal regen accumulator — avoids store writes every physics tick.
// Health regenerates smoothly at 128Hz internally, but store only updates
// when the integer value changes (preventing 128Hz React re-renders).
let _regenHealth = -1;  // -1 = synced with store

// Zone events queued by sensor callbacks, drained by physics tick
export type ZoneEvent =
  | { type: 'boostPad'; direction: [number, number, number]; speed: number }
  | { type: 'launchPad'; direction: [number, number, number]; speed: number }
  | { type: 'speedGate'; multiplier: number; minSpeed: number }
  | { type: 'ammoPickup'; weaponType: WeaponType; amount: number };

/** Ammo state per weapon type */
interface AmmoState {
  current: number;
  max: number;
  magazine?: number;     // current magazine (assault rifle)
  magSize?: number;      // magazine capacity
}

const DEFAULT_AMMO: Record<WeaponType, AmmoState> = {
  rocket:  { current: 10, max: 10, magazine: RELOAD_CONFIG.rocket.magSize, magSize: RELOAD_CONFIG.rocket.magSize },
  grenade: { current: 3, max: 3, magazine: RELOAD_CONFIG.grenade.magSize, magSize: RELOAD_CONFIG.grenade.magSize },
  sniper:  { current: PHYSICS.SNIPER_MAX_AMMO, max: PHYSICS.SNIPER_MAX_AMMO, magazine: RELOAD_CONFIG.sniper.magSize, magSize: RELOAD_CONFIG.sniper.magSize },
  assault: { current: PHYSICS.ASSAULT_MAX_AMMO, max: PHYSICS.ASSAULT_MAX_AMMO, magazine: PHYSICS.ASSAULT_MAG_SIZE, magSize: PHYSICS.ASSAULT_MAG_SIZE },
  shotgun: { current: PHYSICS.SHOTGUN_MAX_AMMO, max: PHYSICS.SHOTGUN_MAX_AMMO, magazine: RELOAD_CONFIG.shotgun.magSize, magSize: RELOAD_CONFIG.shotgun.magSize },
  knife:   { current: Infinity, max: Infinity },
  plasma:  { current: PHYSICS.PLASMA_MAX_AMMO, max: PHYSICS.PLASMA_MAX_AMMO, magazine: RELOAD_CONFIG.plasma.magSize, magSize: RELOAD_CONFIG.plasma.magSize },
};

function cloneAmmo(): Record<WeaponType, AmmoState> {
  const result: Record<string, AmmoState> = {};
  for (const [k, v] of Object.entries(DEFAULT_AMMO)) {
    result[k] = { ...v };
  }
  return result as Record<WeaponType, AmmoState>;
}

interface CombatState {
  // Health
  health: number;
  lastDamageTime: number;

  // Ammo system
  ammo: Record<WeaponType, AmmoState>;

  // Weapon state
  activeWeapon: WeaponType;
  previousWeapon: WeaponType;
  fireCooldown: number;
  swapCooldown: number;
  adsProgress: number;  // 0 = hip, 1 = fully ADS
  isPlasmaFiring: boolean;

  // Scope state (sniper ADS)
  scopeSwayX: number;   // current sway offset X (-1..1)
  scopeSwayY: number;   // current sway offset Y (-1..1)
  isHoldingBreath: boolean;
  breathHoldTime: number;     // seconds of breath held (0-2 = stable, then penalty)
  scopeTime: number;          // total time scoped in (0-3 stable, 3-6 drift, 6+ force unscope)

  // Recoil bloom (for HUD crosshair spread indicator)
  recoilBloom: number;      // 0 = no bloom, higher = wider crosshair spread

  // Reload
  isReloading: boolean;
  reloadProgress: number;  // 0 = just started, 1 = complete
  reloadWeapon: WeaponType | null; // weapon being reloaded (null = none)

  // Weapon inspect
  isInspecting: boolean;
  inspectProgress: number;  // 0 = hip, 1 = fully inspecting

  // Knife lunge
  knifeLungeTimer: number;
  knifeLungeDir: [number, number, number];

  // Grapple
  isGrappling: boolean;
  grappleTarget: [number, number, number] | null;
  grappleLength: number;

  // Zone event queue
  pendingZoneEvents: ZoneEvent[];

  // Grapple point registry
  registeredGrapplePoints: [number, number, number][];

  // Actions
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  regenTick: (dt: number) => void;
  setActiveWeapon: (w: WeaponType) => void;
  switchWeapon: (w: WeaponType) => void;
  switchWeaponBySlot: (slot: number) => void;
  scrollWeapon: (direction: 1 | -1) => void;
  fireHitscan: (weapon: WeaponType) => boolean;
  fireKnife: (dir: [number, number, number]) => boolean;
  startPlasma: () => void;
  stopPlasma: () => void;
  tickPlasma: (dt: number) => void;
  pickupAmmo: (type: WeaponType, amount: number) => void;
  startReload: (weapon: WeaponType) => void;
  completeReload: () => void;
  cancelReload: () => void;
  tickCooldown: (dt: number) => void;
  canFire: () => boolean;

  // Grapple
  startGrapple: (target: [number, number, number], length: number) => void;
  stopGrapple: () => void;

  // Zone events
  pushZoneEvent: (event: ZoneEvent) => void;
  drainZoneEvents: () => ZoneEvent[];

  // Grapple point registry
  registerGrapplePoint: (pos: [number, number, number]) => void;
  unregisterGrapplePoint: (pos: [number, number, number]) => void;

  // Reset
  resetCombat: (rockets: number, grenades: number) => void;
}

export const useCombatStore = create<CombatState>((set, get) => ({
  health: PHYSICS.HEALTH_MAX,
  lastDamageTime: 0,

  ammo: cloneAmmo(),

  activeWeapon: 'rocket',
  previousWeapon: 'rocket',
  fireCooldown: 0,
  swapCooldown: 0,
  adsProgress: 0,
  isPlasmaFiring: false,

  scopeSwayX: 0,
  scopeSwayY: 0,
  isHoldingBreath: false,
  breathHoldTime: 0,
  scopeTime: 0,

  recoilBloom: 0,

  isReloading: false,
  reloadProgress: 0,
  reloadWeapon: null,

  isInspecting: false,
  inspectProgress: 0,

  knifeLungeTimer: 0,
  knifeLungeDir: [0, 0, 0],

  isGrappling: false,
  grappleTarget: null,
  grappleLength: 0,

  pendingZoneEvents: [],
  registeredGrapplePoints: [],

  takeDamage: (amount) => {
    const state = get();
    _regenHealth = -1;  // reset accumulator on damage
    set({
      health: Math.max(0, state.health - amount),
      lastDamageTime: performance.now(),
    });
  },

  heal: (amount) => {
    const state = get();
    _regenHealth = -1;  // reset accumulator on heal
    set({ health: Math.min(PHYSICS.HEALTH_MAX, state.health + amount) });
  },

  regenTick: (dt) => {
    const state = get();
    const current = _regenHealth >= 0 ? _regenHealth : state.health;
    if (current >= PHYSICS.HEALTH_MAX) { _regenHealth = -1; return; }
    const elapsed = (performance.now() - state.lastDamageTime) / 1000;
    if (elapsed < PHYSICS.HEALTH_REGEN_DELAY) return;
    const newHealth = Math.min(PHYSICS.HEALTH_MAX, current + PHYSICS.HEALTH_REGEN_RATE * dt);
    _regenHealth = newHealth;
    // Only write to store when integer value changes (HUD displays integers)
    if (Math.floor(newHealth) !== Math.floor(state.health) || newHealth >= PHYSICS.HEALTH_MAX) {
      set({ health: newHealth });
      if (newHealth >= PHYSICS.HEALTH_MAX) _regenHealth = -1;
    }
  },

  setActiveWeapon: (w) => set({ activeWeapon: w }),

  switchWeapon: (w) => {
    const state = get();
    if (state.activeWeapon === w || state.swapCooldown > 0) return;
    set({
      previousWeapon: state.activeWeapon,
      activeWeapon: w,
      swapCooldown: PHYSICS.WEAPON_SWAP_TIME,
      adsProgress: 0,
      isPlasmaFiring: false,
      recoilBloom: 0,
      isReloading: false,
      reloadProgress: 0,
      reloadWeapon: null,
      isInspecting: false,
      inspectProgress: 0,
      scopeSwayX: 0,
      scopeSwayY: 0,
      isHoldingBreath: false,
      breathHoldTime: 0,
      scopeTime: 0,
    });
  },

  switchWeaponBySlot: (slot) => {
    if (slot < 1 || slot > WEAPON_SLOTS.length) return;
    get().switchWeapon(WEAPON_SLOTS[slot - 1]);
  },

  scrollWeapon: (direction) => {
    const state = get();
    const idx = WEAPON_SLOTS.indexOf(state.activeWeapon);
    const next = (idx + direction + WEAPON_SLOTS.length) % WEAPON_SLOTS.length;
    state.switchWeapon(WEAPON_SLOTS[next]);
  },

  fireHitscan: (weapon) => {
    const state = get();
    if (state.fireCooldown > 0 || state.swapCooldown > 0 || state.isReloading) return false;
    const a = state.ammo[weapon];
    if (!a) return false;
    // Check magazine if present, otherwise check reserve
    const hasMag = a.magazine !== undefined && a.magSize !== undefined;
    if (hasMag && (a.magazine ?? 0) <= 0) return false;
    if (!hasMag && a.current <= 0) return false;

    const newA = { ...a };
    if (hasMag) {
      newA.magazine = (newA.magazine ?? 1) - 1;
    } else {
      newA.current = a.current - 1;
    }

    const cooldown = weapon === 'sniper' ? PHYSICS.SNIPER_FIRE_COOLDOWN
      : weapon === 'assault' ? PHYSICS.ASSAULT_FIRE_COOLDOWN
      : PHYSICS.SHOTGUN_FIRE_COOLDOWN;

    set({
      ammo: { ...state.ammo, [weapon]: newA },
      fireCooldown: cooldown,
    });
    return true;
  },

  fireKnife: (dir) => {
    const state = get();
    if (state.fireCooldown > 0 || state.swapCooldown > 0) return false;
    set({
      fireCooldown: PHYSICS.KNIFE_FIRE_COOLDOWN,
      knifeLungeTimer: PHYSICS.KNIFE_LUNGE_DURATION,
      knifeLungeDir: dir,
    });
    return true;
  },

  startPlasma: () => set({ isPlasmaFiring: true }),
  stopPlasma: () => set({ isPlasmaFiring: false }),
  tickPlasma: (dt) => {
    const state = get();
    if (!state.isPlasmaFiring) return;
    const a = state.ammo.plasma;
    const consumed = PHYSICS.PLASMA_AMMO_PER_SEC * dt;
    const newCurrent = a.current - consumed;
    if (newCurrent <= 0) {
      set({ isPlasmaFiring: false, ammo: { ...state.ammo, plasma: { ...a, current: 0 } } });
    } else {
      set({ ammo: { ...state.ammo, plasma: { ...a, current: newCurrent } } });
    }
  },

  pickupAmmo: (type, amount) => {
    const state = get();
    const a = state.ammo[type];
    if (!a) return;
    const newCurrent = Math.min(a.max, a.current + amount);
    set({
      ammo: { ...state.ammo, [type]: { ...a, current: newCurrent } },
    });
  },

  startReload: (weapon) => {
    const state = get();
    if (state.isReloading || state.swapCooldown > 0) return;
    const cfg = RELOAD_CONFIG[weapon];
    if (!cfg.canReload) return;
    const a = state.ammo[weapon];
    if (!a || a.magazine === undefined || a.magSize === undefined) return;
    // Don't reload if magazine is full or no reserve ammo
    if (a.magazine >= a.magSize) return;
    if (a.current <= 0 && !cfg.perShell) return;
    set({ isReloading: true, reloadProgress: 0, reloadWeapon: weapon });
  },

  completeReload: () => {
    const state = get();
    if (!state.isReloading || !state.reloadWeapon) return;
    const weapon = state.reloadWeapon;
    const cfg = RELOAD_CONFIG[weapon];
    const a = state.ammo[weapon];
    if (!a || a.magazine === undefined || a.magSize === undefined) { set({ isReloading: false, reloadProgress: 0, reloadWeapon: null }); return; }

    let newMag: number;
    let newCurrent: number;
    if (cfg.perShell) {
      // Shotgun: add one shell from reserve to magazine
      const toAdd = Math.min(1, a.current, a.magSize - a.magazine);
      newMag = a.magazine + toAdd;
      newCurrent = a.current - toAdd;
    } else {
      // Standard: fill magazine from reserve
      const needed = a.magSize - a.magazine;
      const toTransfer = Math.min(needed, a.current);
      newMag = a.magazine + toTransfer;
      newCurrent = a.current - toTransfer;
    }

    const stillReloading = cfg.perShell && newMag < a.magSize && newCurrent > 0;
    set({
      ammo: { ...state.ammo, [weapon]: { ...a, magazine: newMag, current: newCurrent } },
      isReloading: stillReloading,
      reloadProgress: stillReloading ? 0 : 0,
      reloadWeapon: stillReloading ? weapon : null,
    });
  },

  cancelReload: () => {
    set({ isReloading: false, reloadProgress: 0, reloadWeapon: null });
  },

  tickCooldown: (dt) => {
    const state = get();
    const updates: Partial<CombatState> = {};
    if (state.fireCooldown > 0) updates.fireCooldown = Math.max(0, state.fireCooldown - dt);
    if (state.swapCooldown > 0) updates.swapCooldown = Math.max(0, state.swapCooldown - dt);
    if (state.knifeLungeTimer > 0) updates.knifeLungeTimer = Math.max(0, state.knifeLungeTimer - dt);
    if (Object.keys(updates).length > 0) set(updates);
  },

  canFire: () => {
    const state = get();
    if (state.fireCooldown > 0 || state.swapCooldown > 0 || state.isReloading) return false;
    const w = state.activeWeapon;
    if (w === 'knife') return true;
    const a = state.ammo[w];
    if (a.magazine !== undefined) return a.magazine > 0;
    return a.current > 0;
  },

  startGrapple: (target, length) => set({ isGrappling: true, grappleTarget: target, grappleLength: length }),
  stopGrapple: () => set({ isGrappling: false, grappleTarget: null, grappleLength: 0 }),

  pushZoneEvent: (event) => {
    const state = get();
    set({ pendingZoneEvents: [...state.pendingZoneEvents, event] });
  },

  drainZoneEvents: () => {
    const state = get();
    if (state.pendingZoneEvents.length === 0) return [];
    const events = state.pendingZoneEvents;
    set({ pendingZoneEvents: [] });
    return events;
  },

  registerGrapplePoint: (pos) => {
    const state = get();
    set({ registeredGrapplePoints: [...state.registeredGrapplePoints, pos] });
  },

  unregisterGrapplePoint: (pos) => {
    const state = get();
    set({
      registeredGrapplePoints: state.registeredGrapplePoints.filter(
        (p) => p[0] !== pos[0] || p[1] !== pos[1] || p[2] !== pos[2],
      ),
    });
  },

  resetCombat: (rockets, grenades) => {
    _regenHealth = -1;
    const fresh = cloneAmmo();
    fresh.rocket.current = rockets;
    fresh.rocket.max = rockets;
    fresh.grenade.current = grenades;
    fresh.grenade.max = grenades;
    set({
      health: PHYSICS.HEALTH_MAX,
      lastDamageTime: 0,
      ammo: fresh,
      activeWeapon: 'rocket',
      previousWeapon: 'rocket',
      fireCooldown: 0,
      swapCooldown: 0,
      adsProgress: 0,
      isPlasmaFiring: false,
      recoilBloom: 0,
      isReloading: false,
      reloadProgress: 0,
      reloadWeapon: null,
      isInspecting: false,
      inspectProgress: 0,
      scopeSwayX: 0,
      scopeSwayY: 0,
      isHoldingBreath: false,
      breathHoldTime: 0,
      scopeTime: 0,
      knifeLungeTimer: 0,
      knifeLungeDir: [0, 0, 0],
      isGrappling: false,
      grappleTarget: null,
      grappleLength: 0,
      pendingZoneEvents: [],
      registeredGrapplePoints: [],
    });
  },
}));
