import { create } from 'zustand';
import { PHYSICS } from '../components/game/physics/constants';
import type { WeaponType } from '../components/game/physics/types';

interface Projectile {
  id: number;
  type: WeaponType;
  position: [number, number, number];
  velocity: [number, number, number];
  spawnTime: number;
  bounces: number; // grenade bounce count
}

// Zone events queued by sensor callbacks, drained by physics tick
export type ZoneEvent =
  | { type: 'boostPad'; direction: [number, number, number]; speed: number }
  | { type: 'launchPad'; direction: [number, number, number]; speed: number }
  | { type: 'speedGate'; multiplier: number; minSpeed: number }
  | { type: 'ammoPickup'; weaponType: WeaponType; amount: number };

interface CombatState {
  // Health
  health: number;
  lastDamageTime: number;

  // Ammo
  rocketAmmo: number;
  grenadeAmmo: number;
  maxRocketAmmo: number;
  maxGrenadeAmmo: number;

  // Weapon state
  activeWeapon: WeaponType;
  fireCooldown: number;

  // Projectiles (managed in physics, rendered in R3F)
  projectiles: Projectile[];
  nextProjectileId: number;

  // Grapple
  isGrappling: boolean;
  grappleTarget: [number, number, number] | null;
  grappleLength: number;

  // Zone event queue
  pendingZoneEvents: ZoneEvent[];

  // Grapple point registry (positions registered by GrapplePoint components)
  registeredGrapplePoints: [number, number, number][];

  // Actions
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  regenTick: (dt: number) => void;
  setActiveWeapon: (w: WeaponType) => void;
  fireRocket: (pos: [number, number, number], vel: [number, number, number]) => number | null;
  fireGrenade: (pos: [number, number, number], vel: [number, number, number]) => number | null;
  removeProjectile: (id: number) => void;
  updateProjectiles: (dt: number) => void;
  pickupAmmo: (type: WeaponType, amount: number) => void;
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

  rocketAmmo: 5,
  grenadeAmmo: 3,
  maxRocketAmmo: 5,
  maxGrenadeAmmo: 3,

  activeWeapon: 'rocket',
  fireCooldown: 0,

  projectiles: [],
  nextProjectileId: 1,

  isGrappling: false,
  grappleTarget: null,
  grappleLength: 0,

  pendingZoneEvents: [],
  registeredGrapplePoints: [],

  takeDamage: (amount) => {
    const state = get();
    set({
      health: Math.max(0, state.health - amount),
      lastDamageTime: performance.now(),
    });
  },

  heal: (amount) => {
    const state = get();
    set({ health: Math.min(PHYSICS.HEALTH_MAX, state.health + amount) });
  },

  regenTick: (dt) => {
    const state = get();
    if (state.health >= PHYSICS.HEALTH_MAX) return;
    const elapsed = (performance.now() - state.lastDamageTime) / 1000;
    if (elapsed < PHYSICS.HEALTH_REGEN_DELAY) return;
    set({ health: Math.min(PHYSICS.HEALTH_MAX, state.health + PHYSICS.HEALTH_REGEN_RATE * dt) });
  },

  setActiveWeapon: (w) => set({ activeWeapon: w }),

  fireRocket: (pos, vel) => {
    const state = get();
    if (state.rocketAmmo <= 0 || state.fireCooldown > 0) return null;
    const id = state.nextProjectileId;
    set({
      rocketAmmo: state.rocketAmmo - 1,
      fireCooldown: PHYSICS.ROCKET_FIRE_COOLDOWN,
      nextProjectileId: id + 1,
      projectiles: [...state.projectiles, {
        id, type: 'rocket', position: pos, velocity: vel,
        spawnTime: performance.now(), bounces: 0,
      }],
    });
    return id;
  },

  fireGrenade: (pos, vel) => {
    const state = get();
    if (state.grenadeAmmo <= 0 || state.fireCooldown > 0) return null;
    const id = state.nextProjectileId;
    set({
      grenadeAmmo: state.grenadeAmmo - 1,
      fireCooldown: PHYSICS.GRENADE_FIRE_COOLDOWN,
      nextProjectileId: id + 1,
      projectiles: [...state.projectiles, {
        id, type: 'grenade', position: pos, velocity: vel,
        spawnTime: performance.now(), bounces: 0,
      }],
    });
    return id;
  },

  removeProjectile: (id) => {
    const state = get();
    set({ projectiles: state.projectiles.filter((p) => p.id !== id) });
  },

  updateProjectiles: (dt) => {
    const state = get();
    const now = performance.now();
    const updated: Projectile[] = [];

    for (const p of state.projectiles) {
      const newPos: [number, number, number] = [
        p.position[0] + p.velocity[0] * dt,
        p.position[1] + p.velocity[1] * dt,
        p.position[2] + p.velocity[2] * dt,
      ];

      if (p.type === 'grenade') {
        // Apply gravity to grenade velocity
        const newVel: [number, number, number] = [
          p.velocity[0],
          p.velocity[1] - PHYSICS.GRAVITY * dt,
          p.velocity[2],
        ];

        // Check fuse timer
        const age = (now - p.spawnTime) / 1000;
        if (age >= PHYSICS.GRENADE_FUSE_TIME) continue; // expired — will be handled by explosion logic

        updated.push({ ...p, position: newPos, velocity: newVel });
      } else {
        // Rocket flies straight
        updated.push({ ...p, position: newPos });
      }
    }

    set({ projectiles: updated });
  },

  pickupAmmo: (type, amount) => {
    const state = get();
    if (type === 'rocket') {
      set({ rocketAmmo: Math.min(state.maxRocketAmmo, state.rocketAmmo + amount) });
    } else {
      set({ grenadeAmmo: Math.min(state.maxGrenadeAmmo, state.grenadeAmmo + amount) });
    }
  },

  tickCooldown: (dt) => {
    const state = get();
    if (state.fireCooldown > 0) {
      set({ fireCooldown: Math.max(0, state.fireCooldown - dt) });
    }
  },

  canFire: () => {
    const state = get();
    if (state.fireCooldown > 0) return false;
    if (state.activeWeapon === 'rocket') return state.rocketAmmo > 0;
    return state.grenadeAmmo > 0;
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

  resetCombat: (rockets, grenades) => set({
    health: PHYSICS.HEALTH_MAX,
    lastDamageTime: 0,
    rocketAmmo: rockets,
    grenadeAmmo: grenades,
    maxRocketAmmo: rockets,
    maxGrenadeAmmo: grenades,
    activeWeapon: 'rocket',
    fireCooldown: 0,
    projectiles: [],
    isGrappling: false,
    grappleTarget: null,
    grappleLength: 0,
    pendingZoneEvents: [],
    registeredGrapplePoints: [],
  }),
}));
