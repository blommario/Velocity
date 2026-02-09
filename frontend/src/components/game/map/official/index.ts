import type { MapData } from '../types';
import { FIRST_STEPS } from './firstSteps';

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
];

export const OFFICIAL_MAP_BY_ID: Record<string, OfficialMap> = Object.fromEntries(
  OFFICIAL_MAPS.map((m) => [m.id, m]),
);

export { FIRST_STEPS };
