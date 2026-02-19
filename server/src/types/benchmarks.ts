export type ArenaCategory = 'text' | 'code' | 'vision';

export interface LMArenaEntry {
  rank: number;
  rankUpper: number;
  rankLower: number;
  modelDisplayName: string;
  rating: number;
  ratingUpper: number;
  ratingLower: number;
  votes: number;
  modelOrganization: string;
  modelUrl: string;
  license: string;
}

export interface ArenaScore {
  rating: number;
  rating_upper: number;
  rating_lower: number;
  rank: number;
  votes: number;
}
