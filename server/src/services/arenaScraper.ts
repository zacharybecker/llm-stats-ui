import axios from 'axios';
import { ArenaEntry } from '../types/benchmarks';
import { getCached, setCached } from './cache';
import { env } from '../config/env';

const CACHE_KEY = 'arena_elo';
const ARENA_API_BASE = 'https://datasets-server.huggingface.co/rows?dataset=mathewhe%2Fchatbot-arena-elo&config=default&split=train';

export async function fetchArenaRankings(): Promise<ArenaEntry[]> {
  const cached = getCached<ArenaEntry[]>(CACHE_KEY);
  if (cached) return cached;

  try {
    const allRows: Array<{ row: Record<string, unknown> }> = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const response = await axios.get(`${ARENA_API_BASE}&offset=${offset}&length=${pageSize}`, {
        timeout: 15000,
        headers: { 'Accept': 'application/json' },
      });

      const rows = response.data?.rows || [];
      allRows.push(...rows);

      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    if (allRows.length === 0) throw new Error('Empty response from Arena dataset');

    const entries: ArenaEntry[] = allRows.map((row) => {
      const r = row.row;
      return {
        name: (r['Model'] as string) || '',
        key: (r['Model'] as string) || '',
        elo: (r['Arena Score'] as number) || undefined,
        rating: (r['Arena Score'] as number) || undefined,
        organization: (r['Organization'] as string) || undefined,
        num_battles: (r['Votes'] as number) || undefined,
      };
    }).filter((e: ArenaEntry) => e.name);

    setCached(CACHE_KEY, entries, env.ARENA_CACHE_TTL);
    console.log(`Fetched ${entries.length} entries from Arena leaderboard`);
    return entries;
  } catch (error) {
    console.error('Failed to fetch Arena leaderboard:', error instanceof Error ? error.message : error);
    throw new Error('Failed to fetch Arena leaderboard data');
  }
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
