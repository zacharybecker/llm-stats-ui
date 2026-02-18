import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { OpenLLMLeaderboardEntry } from '../types/benchmarks';
import { getCached, setCached } from './cache';
import { env } from '../config/env';

const CACHE_KEY = 'openllm_benchmarks';
const HF_API_URL = 'https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fresults&config=default&split=train&offset=0&length=200';

function loadFallbackBenchmarks(): OpenLLMLeaderboardEntry[] {
  try {
    const fallbackPath = path.join(__dirname, '..', 'data', 'fallback-benchmarks.json');
    // Try compiled location first, then source location
    const tryPaths = [
      fallbackPath,
      path.join(__dirname, '..', '..', 'src', 'data', 'fallback-benchmarks.json'),
    ];
    for (const p of tryPaths) {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        console.log(`Loaded ${data.length} fallback benchmark entries`);
        return data;
      }
    }
  } catch (e) {
    console.error('Failed to load fallback benchmarks');
  }
  return [];
}

export async function fetchOpenLLMBenchmarks(): Promise<OpenLLMLeaderboardEntry[]> {
  const cached = getCached<OpenLLMLeaderboardEntry[]>(CACHE_KEY);
  if (cached) return cached;

  try {
    const response = await axios.get(HF_API_URL, {
      timeout: 15000,
      headers: { 'Accept': 'application/json' },
    });

    const rows = response.data?.rows || [];
    if (rows.length === 0) throw new Error('Empty response');

    const entries: OpenLLMLeaderboardEntry[] = rows.map((row: { row: Record<string, unknown> }) => {
      const r = row.row;
      return {
        model_name: (r['fullname'] as string) || (r['model_name'] as string) || '',
        average: (r['average'] as number) || 0,
        mmlu_pro: r['mmlu_pro'] as number | undefined,
        gpqa: r['gpqa'] as number | undefined,
        math: (r['math_lvl5'] as number) || (r['math'] as number) || undefined,
        bbh: r['bbh'] as number | undefined,
        ifeval: r['ifeval'] as number | undefined,
        musr: r['musr'] as number | undefined,
      };
    });

    setCached(CACHE_KEY, entries, env.BENCHMARK_CACHE_TTL);
    console.log(`Fetched ${entries.length} entries from Open LLM Leaderboard`);
    return entries;
  } catch (error) {
    console.warn('Live benchmark fetch failed, using fallback data');
    const fallback = loadFallbackBenchmarks();
    if (fallback.length > 0) {
      setCached(CACHE_KEY, fallback, env.BENCHMARK_CACHE_TTL);
    }
    return fallback;
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
