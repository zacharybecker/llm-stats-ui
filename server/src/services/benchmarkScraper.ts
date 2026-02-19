import axios from 'axios';
import { OpenLLMLeaderboardEntry } from '../types/benchmarks';
import { getCached, setCached } from './cache';
import { env } from '../config/env';

const CACHE_KEY = 'openllm_benchmarks';
const HF_API_URL = 'https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train&offset=0&length=100';

export async function fetchOpenLLMBenchmarks(): Promise<OpenLLMLeaderboardEntry[]> {
  const cached = getCached<OpenLLMLeaderboardEntry[]>(CACHE_KEY);
  if (cached) return cached;

  try {
    const response = await axios.get(HF_API_URL, {
      timeout: 15000,
      headers: { 'Accept': 'application/json' },
    });

    const rows = response.data?.rows || [];
    if (rows.length === 0) throw new Error('Empty response from HuggingFace');

    const entries: OpenLLMLeaderboardEntry[] = rows.map((row: { row: Record<string, unknown> }) => {
      const r = row.row;
      return {
        model_name: (r['fullname'] as string) || (r['Model'] as string) || '',
        average: (r['Average ⬆️'] as number) || 0,
        mmlu_pro: r['MMLU-PRO'] as number | undefined,
        gpqa: r['GPQA'] as number | undefined,
        math: (r['MATH Lvl 5'] as number) || undefined,
        bbh: r['BBH'] as number | undefined,
        ifeval: r['IFEval'] as number | undefined,
        musr: r['MUSR'] as number | undefined,
      };
    });

    setCached(CACHE_KEY, entries, env.BENCHMARK_CACHE_TTL);
    console.log(`Fetched ${entries.length} entries from Open LLM Leaderboard`);
    return entries;
  } catch (error) {
    console.error('Failed to fetch Open LLM Leaderboard:', error instanceof Error ? error.message : error);
    throw new Error('Failed to fetch Open LLM Leaderboard data');
  }
}

export function buildBenchmarkMap(entries: OpenLLMLeaderboardEntry[]): Map<string, OpenLLMLeaderboardEntry> {
  const map = new Map<string, OpenLLMLeaderboardEntry>();
  for (const entry of entries) {
    if (entry.model_name) {
      map.set(entry.model_name.toLowerCase(), entry);
      const shortName = entry.model_name.split('/').pop()?.toLowerCase();
      if (shortName && !map.has(shortName)) {
        map.set(shortName, entry);
      }
    }
  }
  return map;
}
