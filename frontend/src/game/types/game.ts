/**
 * Game-layer type definitions for map metadata and difficulty levels.
 *
 * Depends on: none
 * Used by: MainMenu, MapBrowser
 */
export const MAP_DIFFICULTIES = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  EXPERT: 'Expert',
} as const;

export type MapDifficulty = (typeof MAP_DIFFICULTIES)[keyof typeof MAP_DIFFICULTIES];

export interface MapResponse {
  id: string;
  name: string;
  description: string;
  authorName: string;
  difficulty: MapDifficulty;
  isOfficial: boolean;
  playCount: number;
  likeCount: number;
  worldRecordTime: number | null;
  mapDataJson: string;
  createdAt: string;
}
