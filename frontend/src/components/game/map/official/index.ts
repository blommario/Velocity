import type { MapData } from '../types';
import { FIRST_STEPS } from './firstSteps';
import { CLIFFSIDE } from './cliffside';
import { NEON_DISTRICT } from './neonDistrict';
import { THE_GAUNTLET } from './theGauntlet';
import { SKYBREAK } from './skybreak';

export interface OfficialMap {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  description: string;
  parTime: number;
  data: MapData;
}

export const OFFICIAL_MAPS: OfficialMap[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    difficulty: 'Easy',
    description: 'Tutorial: corridors, curves, small gaps. Learn the basics of movement.',
    parTime: 45,
    data: FIRST_STEPS,
  },
  {
    id: 'cliffside',
    name: 'Cliffside',
    difficulty: 'Medium',
    description: 'Rocky mountain with surf ramps and rocket jump shortcuts. Hidden cave.',
    parTime: 90,
    data: CLIFFSIDE,
  },
  {
    id: 'neon-district',
    name: 'Neon District',
    difficulty: 'Medium',
    description: 'Cyberpunk city with wall running, speed gates, and boost pads.',
    parTime: 75,
    data: NEON_DISTRICT,
  },
  {
    id: 'the-gauntlet',
    name: 'The Gauntlet',
    difficulty: 'Hard',
    description: 'Industrial gauntlet requiring all mechanics. Multiple routes with risk/reward.',
    parTime: 120,
    data: THE_GAUNTLET,
  },
  {
    id: 'skybreak',
    name: 'Skybreak',
    difficulty: 'Expert',
    description: 'Tactical operations compound. Concrete corridors, elevated walkways, wall-run channels.',
    parTime: 90,
    data: SKYBREAK,
  },
];

export const OFFICIAL_MAP_BY_ID: Record<string, OfficialMap> = Object.fromEntries(
  OFFICIAL_MAPS.map((m) => [m.id, m]),
);

export { FIRST_STEPS, CLIFFSIDE, NEON_DISTRICT, THE_GAUNTLET, SKYBREAK };
