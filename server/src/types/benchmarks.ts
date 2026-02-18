export interface OpenLLMLeaderboardEntry {
  model_name: string;
  model_sha?: string;
  average: number;
  mmlu_pro?: number;
  gpqa?: number;
  math?: number;
  bbh?: number;
  ifeval?: number;
  musr?: number;
  [key: string]: unknown;
}

export interface ArenaEntry {
  name: string;
  key?: string;
  elo?: number;
  rating?: number;
  ci_95_upper?: number;
  ci_95_lower?: number;
  num_battles?: number;
  organization?: string;
  categories?: Record<string, number>;
}

export interface ArenaResponse {
  data?: ArenaEntry[];
  [key: string]: unknown;
}
