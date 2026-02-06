export interface MapDto {
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

export type MapDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';
