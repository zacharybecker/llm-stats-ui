export type ArenaCategory = 'text' | 'code' | 'vision';

export interface LMArenaEntry {
  rank: number;
  modelDisplayName: string;
  rating: number;
  ratingUpper: number;
  ratingLower: number;
  votes: number;
}

export interface ArenaScore {
  rating: number;
  rating_upper: number;
  rating_lower: number;
  rank: number;
  votes: number;
}
