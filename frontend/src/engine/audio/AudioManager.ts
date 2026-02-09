import { useSettingsStore } from '../../stores/settingsStore';

// ── Sound IDs ──

export const SOUNDS = {
  // Movement
  FOOTSTEP_STONE: 'footstep_stone',
  FOOTSTEP_METAL: 'footstep_metal',
  FOOTSTEP_GLASS: 'footstep_glass',
  JUMP: 'jump',
  LAND_SOFT: 'land_soft',
  LAND_HARD: 'land_hard',
  SLIDE: 'slide',
  WALL_RUN: 'wall_run',

  // Weapons
  ROCKET_FIRE: 'rocket_fire',
  ROCKET_EXPLODE: 'rocket_explode',
  GRENADE_THROW: 'grenade_throw',
  GRENADE_BOUNCE: 'grenade_bounce',
  GRENADE_EXPLODE: 'grenade_explode',

  // Grapple
  GRAPPLE_FIRE: 'grapple_fire',
  GRAPPLE_ATTACH: 'grapple_attach',
  GRAPPLE_RELEASE: 'grapple_release',

  // Zones
  BOOST_PAD: 'boost_pad',
  LAUNCH_PAD: 'launch_pad',
  SPEED_GATE: 'speed_gate',
  AMMO_PICKUP: 'ammo_pickup',

  // Gameplay
  CHECKPOINT: 'checkpoint',
  FINISH: 'finish',
  COUNTDOWN_TICK: 'countdown_tick',
  COUNTDOWN_GO: 'countdown_go',

  // Hit feedback
  HIT_MARKER: 'hit_marker',
  WALL_IMPACT: 'wall_impact',

  // UI
  UI_CLICK: 'ui_click',
  UI_HOVER: 'ui_hover',
} as const;

export type SoundId = (typeof SOUNDS)[keyof typeof SOUNDS];

// ── Sound categories ──

const SOUND_CATEGORIES: Record<SoundId, 'sfx' | 'music' | 'ambient'> = {
  [SOUNDS.FOOTSTEP_STONE]: 'sfx',
  [SOUNDS.FOOTSTEP_METAL]: 'sfx',
  [SOUNDS.FOOTSTEP_GLASS]: 'sfx',
  [SOUNDS.JUMP]: 'sfx',
  [SOUNDS.LAND_SOFT]: 'sfx',
  [SOUNDS.LAND_HARD]: 'sfx',
  [SOUNDS.SLIDE]: 'sfx',
  [SOUNDS.WALL_RUN]: 'sfx',
  [SOUNDS.ROCKET_FIRE]: 'sfx',
  [SOUNDS.ROCKET_EXPLODE]: 'sfx',
  [SOUNDS.GRENADE_THROW]: 'sfx',
  [SOUNDS.GRENADE_BOUNCE]: 'sfx',
  [SOUNDS.GRENADE_EXPLODE]: 'sfx',
  [SOUNDS.GRAPPLE_FIRE]: 'sfx',
  [SOUNDS.GRAPPLE_ATTACH]: 'sfx',
  [SOUNDS.GRAPPLE_RELEASE]: 'sfx',
  [SOUNDS.BOOST_PAD]: 'sfx',
  [SOUNDS.LAUNCH_PAD]: 'sfx',
  [SOUNDS.SPEED_GATE]: 'sfx',
  [SOUNDS.AMMO_PICKUP]: 'sfx',
  [SOUNDS.CHECKPOINT]: 'sfx',
  [SOUNDS.FINISH]: 'sfx',
  [SOUNDS.COUNTDOWN_TICK]: 'sfx',
  [SOUNDS.COUNTDOWN_GO]: 'sfx',
  [SOUNDS.HIT_MARKER]: 'sfx',
  [SOUNDS.WALL_IMPACT]: 'sfx',
  [SOUNDS.UI_CLICK]: 'sfx',
  [SOUNDS.UI_HOVER]: 'sfx',
};

// ── Synthesized placeholder sounds ──
// Since we don't have audio files, synthesize simple sounds with Web Audio API

interface SynthConfig {
  frequency: number;
  type: OscillatorType;
  duration: number;
  gain: number;
  decay?: number;     // Exponential decay time
  filterFreq?: number; // Low-pass filter cutoff
}

const SYNTH_CONFIGS: Partial<Record<SoundId, SynthConfig>> = {
  [SOUNDS.JUMP]: { frequency: 200, type: 'sine', duration: 0.1, gain: 0.3, decay: 0.08 },
  [SOUNDS.LAND_SOFT]: { frequency: 80, type: 'sine', duration: 0.15, gain: 0.2, decay: 0.12 },
  [SOUNDS.LAND_HARD]: { frequency: 60, type: 'triangle', duration: 0.25, gain: 0.4, decay: 0.2 },
  [SOUNDS.FOOTSTEP_STONE]: { frequency: 120, type: 'square', duration: 0.05, gain: 0.1, filterFreq: 400 },
  [SOUNDS.FOOTSTEP_METAL]: { frequency: 800, type: 'square', duration: 0.04, gain: 0.08, filterFreq: 2000 },
  [SOUNDS.FOOTSTEP_GLASS]: { frequency: 2000, type: 'sine', duration: 0.03, gain: 0.06 },
  [SOUNDS.SLIDE]: { frequency: 150, type: 'sawtooth', duration: 0.3, gain: 0.15, filterFreq: 600 },
  [SOUNDS.WALL_RUN]: { frequency: 100, type: 'square', duration: 0.06, gain: 0.1, filterFreq: 500 },
  [SOUNDS.ROCKET_FIRE]: { frequency: 100, type: 'sawtooth', duration: 0.3, gain: 0.5, decay: 0.25, filterFreq: 800 },
  [SOUNDS.ROCKET_EXPLODE]: { frequency: 40, type: 'sawtooth', duration: 0.6, gain: 0.6, decay: 0.5, filterFreq: 400 },
  [SOUNDS.GRENADE_THROW]: { frequency: 300, type: 'sine', duration: 0.1, gain: 0.2 },
  [SOUNDS.GRENADE_BOUNCE]: { frequency: 500, type: 'triangle', duration: 0.08, gain: 0.15 },
  [SOUNDS.GRENADE_EXPLODE]: { frequency: 50, type: 'sawtooth', duration: 0.5, gain: 0.55, decay: 0.4, filterFreq: 500 },
  [SOUNDS.GRAPPLE_FIRE]: { frequency: 600, type: 'square', duration: 0.15, gain: 0.3, filterFreq: 1200 },
  [SOUNDS.GRAPPLE_ATTACH]: { frequency: 800, type: 'sine', duration: 0.1, gain: 0.25 },
  [SOUNDS.GRAPPLE_RELEASE]: { frequency: 400, type: 'sine', duration: 0.12, gain: 0.2, decay: 0.1 },
  [SOUNDS.BOOST_PAD]: { frequency: 300, type: 'sine', duration: 0.2, gain: 0.3, decay: 0.15 },
  [SOUNDS.LAUNCH_PAD]: { frequency: 200, type: 'sine', duration: 0.3, gain: 0.35, decay: 0.25 },
  [SOUNDS.SPEED_GATE]: { frequency: 1000, type: 'sine', duration: 0.15, gain: 0.2 },
  [SOUNDS.AMMO_PICKUP]: { frequency: 880, type: 'sine', duration: 0.1, gain: 0.2 },
  [SOUNDS.CHECKPOINT]: { frequency: 1200, type: 'sine', duration: 0.2, gain: 0.3 },
  [SOUNDS.FINISH]: { frequency: 800, type: 'sine', duration: 0.5, gain: 0.4 },
  [SOUNDS.COUNTDOWN_TICK]: { frequency: 600, type: 'sine', duration: 0.08, gain: 0.2 },
  [SOUNDS.COUNTDOWN_GO]: { frequency: 1000, type: 'sine', duration: 0.15, gain: 0.3 },
  [SOUNDS.HIT_MARKER]: { frequency: 1600, type: 'square', duration: 0.06, gain: 0.15, filterFreq: 3000 },
  [SOUNDS.WALL_IMPACT]: { frequency: 400, type: 'sawtooth', duration: 0.08, gain: 0.12, decay: 0.06, filterFreq: 800 },
  [SOUNDS.UI_CLICK]: { frequency: 1400, type: 'sine', duration: 0.04, gain: 0.1 },
  [SOUNDS.UI_HOVER]: { frequency: 1800, type: 'sine', duration: 0.02, gain: 0.05 },
};

// ── Audio Manager ──

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  play(soundId: SoundId, pitchVariation = 0): void {
    const settings = useSettingsStore.getState();
    const category = SOUND_CATEGORIES[soundId];

    // Calculate volume
    const categoryVolume = category === 'sfx' ? settings.sfxVolume
      : category === 'music' ? settings.musicVolume
      : settings.ambientVolume;
    const volume = settings.masterVolume * categoryVolume;
    if (volume <= 0) return;

    const config = SYNTH_CONFIGS[soundId];
    if (!config) return;

    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Oscillator
    const osc = ctx.createOscillator();
    osc.type = config.type;
    const pitch = config.frequency * (1 + (Math.random() - 0.5) * pitchVariation * 2);
    osc.frequency.setValueAtTime(pitch, now);

    // Gain envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(config.gain * volume, now);
    if (config.decay) {
      gain.gain.exponentialRampToValueAtTime(0.001, now + (config.decay ?? config.duration));
    } else {
      gain.gain.linearRampToValueAtTime(0, now + config.duration);
    }

    // Optional low-pass filter
    if (config.filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(config.filterFreq, now);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + config.duration + 0.05);
  }

  /** Play footstep based on surface material */
  playFootstep(surfaceMaterial?: string): void {
    switch (surfaceMaterial) {
      case 'metal': this.play(SOUNDS.FOOTSTEP_METAL, 0.1); break;
      case 'glass': this.play(SOUNDS.FOOTSTEP_GLASS, 0.1); break;
      default: this.play(SOUNDS.FOOTSTEP_STONE, 0.15); break;
    }
  }
}

export const audioManager = new AudioManager();
