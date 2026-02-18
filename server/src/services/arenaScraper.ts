import axios from 'axios';
import { ArenaEntry } from '../types/benchmarks';
import { getCached, setCached } from './cache';
import { env } from '../config/env';

const CACHE_KEY = 'arena_elo';
const ARENA_URLS = [
  'https://raw.githubusercontent.com/lm-sys/FastChat/main/fastchat/serve/leaderboard/elo_results/latest/elo_results.json',
  'https://raw.githubusercontent.com/lmarena/chatbot-arena-leaderboard/main/data/leaderboard_table.json',
];

export async function fetchArenaRankings(): Promise<ArenaEntry[]> {
  const cached = getCached<ArenaEntry[]>(CACHE_KEY);
  if (cached) return cached;

  const errors: string[] = [];

  for (const url of ARENA_URLS) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      const data = response.data;

      let entries: ArenaEntry[] = [];
      if (Array.isArray(data)) {
        entries = normalizeArenaData(data);
      } else if (data && typeof data === 'object') {
        entries = normalizeObjectFormat(data);
      }

      if (entries.length > 0) {
        setCached(CACHE_KEY, entries, env.ARENA_CACHE_TTL);
        console.log(`Fetched ${entries.length} entries from Arena leaderboard`);
        return entries;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  console.error('All Arena leaderboard sources failed:', errors.join('; '));
  throw new Error('Failed to fetch Arena leaderboard data');
}

function normalizeArenaData(data: unknown[]): ArenaEntry[] {
  return data
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => ({
      name: (item.name as string) || (item.model as string) || (item.key as string) || '',
      key: (item.key as string) || (item.model as string) || '',
      elo: (item.elo as number) || (item.rating as number) || (item.score as number) || undefined,
      rating: (item.rating as number) || (item.elo as number) || undefined,
      organization: (item.organization as string) || (item.org as string) || undefined,
      num_battles: (item.num_battles as number) || undefined,
    }))
    .filter((e) => e.name);
}

function normalizeObjectFormat(data: Record<string, unknown>): ArenaEntry[] {
  const entries: ArenaEntry[] = [];
  const categories: Record<string, Record<string, number>> = {};

  for (const [_section, sectionData] of Object.entries(data)) {
    if (!sectionData || typeof sectionData !== 'object') continue;

    for (const [category, categoryData] of Object.entries(sectionData as Record<string, unknown>)) {
      if (!categoryData || typeof categoryData !== 'object') continue;

      for (const [modelName, modelData] of Object.entries(categoryData as Record<string, unknown>)) {
        if (!modelData || typeof modelData !== 'object') continue;
        const md = modelData as Record<string, unknown>;
        const elo = (md.elo as number) || (md.rating as number);
        if (!elo) continue;

        if (!categories[modelName]) categories[modelName] = {};
        categories[modelName][category] = elo;
      }
    }
  }

  for (const [name, cats] of Object.entries(categories)) {
    entries.push({
      name,
      key: name,
      elo: cats.overall || cats.full || Object.values(cats)[0],
      rating: cats.overall || cats.full || Object.values(cats)[0],
      categories: cats,
    });
  }

  return entries;
}

export function buildArenaMap(entries: ArenaEntry[]): Map<string, ArenaEntry> {
  const map = new Map<string, ArenaEntry>();
  for (const entry of entries) {
    const name = (entry.name || '').toLowerCase();
    if (name) map.set(name, entry);
    const key = (entry.key || '').toLowerCase();
    if (key && !map.has(key)) map.set(key, entry);
    for (const val of [name, key]) {
      if (!val) continue;
      const stripped = val
        .replace(/-\d{4}-\d{2}(-\d{2})?$/, '')
        .replace(/-preview$/, '')
        .replace(/-latest$/, '');
      if (stripped && !map.has(stripped)) {
        map.set(stripped, entry);
      }
    }
  }
  return map;
}
