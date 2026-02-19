import axios from 'axios';
import { LMArenaEntry, ArenaCategory } from '../types/benchmarks';
import { getCached, setCached } from './cache';
import { env } from '../config/env';

const ARENA_URLS: Record<ArenaCategory, string> = {
  text: 'https://arena.ai/leaderboard/text',
  code: 'https://arena.ai/leaderboard/code',
  vision: 'https://arena.ai/leaderboard/vision',
};

function cacheKey(category: ArenaCategory): string {
  return `lmarena_${category.replace('-', '_')}`;
}

/**
 * Parse LMArena entries from a Next.js page's embedded flight data.
 *
 * Next.js RSC pages embed data in script tags as:
 *   self.__next_f.push([1,"<escaped content>"])
 *
 * The content uses JS string escaping (\" for quotes, \\ for backslash),
 * so we can't use a simple (.+?) regex. Instead we:
 * 1. Extract all push payload strings handling escaped chars
 * 2. Unescape them
 * 3. Search for JSON objects with the right fields
 */
function parseEntriesFromHTML(html: string): LMArenaEntry[] {
  const entries: LMArenaEntry[] = [];
  const seen = new Set<string>();

  // Strategy 1: Extract self.__next_f.push payloads with proper escape handling
  // Match the opening: self.__next_f.push([1," then capture until unescaped "])
  const pushPrefix = 'self.__next_f.push([1,"';
  let searchStart = 0;

  while (true) {
    const prefixIdx = html.indexOf(pushPrefix, searchStart);
    if (prefixIdx === -1) break;

    const contentStart = prefixIdx + pushPrefix.length;
    // Walk forward, respecting escape sequences, to find the closing "])
    let i = contentStart;
    while (i < html.length) {
      if (html[i] === '\\') {
        i += 2; // skip escaped char
        continue;
      }
      if (html[i] === '"') break; // unescaped quote = end of string
      i++;
    }

    const raw = html.substring(contentStart, i);
    searchStart = i + 1;

    // Unescape the JS string literal
    let unescaped: string;
    try {
      unescaped = JSON.parse(`"${raw}"`);
    } catch {
      // Fallback manual unescape
      unescaped = raw
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    }

    extractEntries(unescaped, entries, seen);
  }

  // Strategy 2: Also search raw HTML directly for any JSON-like model objects
  // (handles cases where data might be in __NEXT_DATA__ or inline scripts)
  extractEntries(html, entries, seen);

  return entries;
}

function extractEntries(
  text: string,
  entries: LMArenaEntry[],
  seen: Set<string>
): void {
  // Find JSON objects with modelDisplayName and rating fields
  // Use a pattern that handles nested quotes by matching field-by-field
  const regex = /\{[^{}]*?"modelDisplayName"\s*:\s*"([^"]+?)"[^{}]*?"rating"\s*:\s*([\d.]+)[^{}]*?\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const displayName = match[1];
    if (seen.has(displayName)) continue;

    try {
      const obj = JSON.parse(match[0]);
      if (obj.modelDisplayName && typeof obj.rating === 'number') {
        seen.add(obj.modelDisplayName);
        entries.push({
          rank: obj.rank ?? 0,
          modelDisplayName: obj.modelDisplayName,
          rating: obj.rating,
          ratingUpper: obj.ratingUpper ?? obj.rating,
          ratingLower: obj.ratingLower ?? obj.rating,
          votes: obj.votes ?? 0,
        });
      }
    } catch {
      // If full JSON parse fails, extract what we can from the regex captures
      if (displayName && !seen.has(displayName)) {
        const ratingVal = parseFloat(match[2]);
        if (!isNaN(ratingVal)) {
          seen.add(displayName);

          // Try to extract other fields with individual regexes
          const rankMatch = match[0].match(/"rank"\s*:\s*(\d+)/);
          const ratingUpperMatch = match[0].match(/"ratingUpper"\s*:\s*([\d.]+)/);
          const ratingLowerMatch = match[0].match(/"ratingLower"\s*:\s*([\d.]+)/);
          const votesMatch = match[0].match(/"votes"\s*:\s*(\d+)/);

          entries.push({
            rank: rankMatch ? parseInt(rankMatch[1]) : 0,
            modelDisplayName: displayName,
            rating: ratingVal,
            ratingUpper: ratingUpperMatch ? parseFloat(ratingUpperMatch[1]) : ratingVal,
            ratingLower: ratingLowerMatch ? parseFloat(ratingLowerMatch[1]) : ratingVal,
            votes: votesMatch ? parseInt(votesMatch[1]) : 0,
          });
        }
      }
    }
  }
}

async function fetchCategory(category: ArenaCategory): Promise<LMArenaEntry[]> {
  const key = cacheKey(category);
  const cached = getCached<LMArenaEntry[]>(key);
  if (cached) return cached;

  const url = ARENA_URLS[category];
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      'Accept': 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; ModelStats/1.0)',
    },
  });

  const entries = parseEntriesFromHTML(response.data);
  if (entries.length === 0) {
    throw new Error(`No entries parsed from LMArena ${category} page`);
  }

  setCached(key, entries, env.ARENA_CACHE_TTL);
  console.log(`Fetched ${entries.length} entries from LMArena ${category} leaderboard`);
  return entries;
}

export interface LMArenaData {
  text: LMArenaEntry[];
  code: LMArenaEntry[];
  vision: LMArenaEntry[];
}

/**
 * Fetch all 3 LMArena categories in parallel.
 * Individual category failures return empty arrays.
 */
export async function fetchLMArenaData(): Promise<LMArenaData> {
  const [text, code, vision] = await Promise.all([
    fetchCategory('text').catch((err) => {
      console.error('Failed to fetch LMArena text:', err instanceof Error ? err.message : err);
      return [] as LMArenaEntry[];
    }),
    fetchCategory('code').catch((err) => {
      console.error('Failed to fetch LMArena code:', err instanceof Error ? err.message : err);
      return [] as LMArenaEntry[];
    }),
    fetchCategory('vision').catch((err) => {
      console.error('Failed to fetch LMArena vision:', err instanceof Error ? err.message : err);
      return [] as LMArenaEntry[];
    }),
  ]);

  return { text, code, vision };
}

/**
 * Build a fuzzy-match map from model display names to entries.
 * Generates multiple normalized key variants to maximize matching.
 */
export function buildLMArenaMap(entries: LMArenaEntry[]): Map<string, LMArenaEntry> {
  const map = new Map<string, LMArenaEntry>();
  for (const entry of entries) {
    const name = entry.modelDisplayName.toLowerCase();
    if (!name) continue;

    map.set(name, entry);

    // Strip date suffixes: "-2025-04-14", "-20250514", "-0125"
    const noDate = name
      .replace(/-\d{4}-\d{2}-\d{2}$/, '')
      .replace(/-\d{8}$/, '')
      .replace(/-\d{4}$/, '');
    if (noDate !== name && !map.has(noDate)) {
      map.set(noDate, entry);
    }

    // Strip common suffixes
    const stripped = name
      .replace(/-\d{4}-\d{2}(-\d{2})?$/, '')
      .replace(/-preview$/, '')
      .replace(/-latest$/, '')
      .replace(/-instruct$/, '')
      .replace(/-chat$/, '')
      .replace(/-bf16$/, '')
      .replace(/-fp8$/, '');
    if (stripped !== name && !map.has(stripped)) {
      map.set(stripped, entry);
    }

    // Strip parenthetical qualifiers: "gemini-3-flash (thinking-minimal)" → "gemini-3-flash"
    const noParens = name.replace(/\s*\(.*?\)\s*$/, '').trim();
    if (noParens !== name && !map.has(noParens)) {
      map.set(noParens, entry);
    }

    // Dots to dashes variant: "gpt-4.1" → "gpt-4-1"
    const dotsToDashes = name.replace(/\./g, '-');
    if (dotsToDashes !== name && !map.has(dotsToDashes)) {
      map.set(dotsToDashes, entry);
    }

    // Also strip date suffixes from dots-to-dashes variant
    const dtdNoDate = dotsToDashes
      .replace(/-\d{4}-\d{2}-\d{2}$/, '')
      .replace(/-\d{8}$/, '')
      .replace(/-\d{4}$/, '');
    if (dtdNoDate !== dotsToDashes && !map.has(dtdNoDate)) {
      map.set(dtdNoDate, entry);
    }
  }
  return map;
}
