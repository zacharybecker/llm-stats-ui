import { LiteLLMModelEntry, LiteLLMPricingMap, LiteLLMPricingEntry } from '../types/litellm';
import { OpenRouterModel } from '../types/openrouter';
import { OpenLLMLeaderboardEntry, ArenaEntry } from '../types/benchmarks';
import { MergedModel } from '../types/models';
import { parseConfig } from './configParser';
import { fetchOpenRouterModels, buildOpenRouterMap } from './openRouterClient';
import { fetchLiteLLMPricing } from './litellmPricing';
import { fetchOpenLLMBenchmarks, buildBenchmarkMap } from './benchmarkScraper';
import { fetchArenaRankings, buildArenaMap } from './arenaScraper';
import { env } from '../config/env';

function debug(...args: unknown[]) {
  if (env.DEBUG) console.log('[DEBUG]', ...args);
}

function normalizeModelId(id: string): string {
  return id
    .toLowerCase()
    .replace(/-\d{4}-\d{2}(-\d{2})?$/, '') // strip date suffixes
    .replace(/-preview$/, '')
    .replace(/-latest$/, '')
    .replace(/:free$/, '')
    .replace(/:extended$/, '');
}

function bareModelName(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1].toLowerCase();
}

function extractProvider(modelId: string): string {
  const parts = modelId.split('/');
  return parts.length > 1 ? parts[0] : 'unknown';
}

/**
 * Aggressively normalize a model name for fuzzy arena matching.
 * Strips version numbers, date suffixes, common suffixes, and normalizes separators.
 */
function normalizeForArenaMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/-instruct$/, '')
    .replace(/-chat$/, '')
    .replace(/-hf$/, '')
    .replace(/-online$/, '')
    .replace(/:free$/, '')
    .replace(/:extended$/, '')
    // Strip date suffixes like -2024-01-01 or -2411
    .replace(/-\d{4}-\d{2}(-\d{2})?$/, '')
    .replace(/-\d{4}$/, '')
    // Strip -preview, -latest, -exp
    .replace(/-preview$/, '')
    .replace(/-latest$/, '')
    .replace(/-exp$/, '')
    // Strip trailing -001, -002 etc version suffixes
    .replace(/-0\d{2}$/, '')
    // Normalize dots and dashes (try both)
    .replace(/\./g, '-');
}

/**
 * Generate candidate keys from a model name for arena lookup.
 * Produces multiple normalized variants to match against the arena map.
 */
function arenaMatchCandidates(modelId: string): string[] {
  const bare = bareModelName(modelId);
  const normalized = normalizeModelId(bare);
  const aggressive = normalizeForArenaMatch(bare);

  const candidates = new Set<string>();
  candidates.add(bare);
  candidates.add(normalized);
  candidates.add(aggressive);

  // Also try with dots as dashes and vice versa
  candidates.add(bare.replace(/\./g, '-'));
  candidates.add(bare.replace(/-/g, '.'));
  candidates.add(normalized.replace(/\./g, '-'));
  candidates.add(normalized.replace(/-/g, '.'));

  // Handle version number reordering: "gemini-pro-1.5" <-> "gemini-1.5-pro"
  // Match pattern: name-variant-version <-> name-version-variant
  const versionSwap = bare.match(/^(.+?)-([a-z]+)-(\d+[\.\d]*)$/);
  if (versionSwap) {
    candidates.add(`${versionSwap[1]}-${versionSwap[3]}-${versionSwap[2]}`);
    candidates.add(`${versionSwap[1]}-${versionSwap[3].replace(/\./g, '-')}-${versionSwap[2]}`);
  }
  const versionSwap2 = bare.match(/^(.+?)-(\d+[\.\d]*)-([a-z]+)$/);
  if (versionSwap2) {
    candidates.add(`${versionSwap2[1]}-${versionSwap2[3]}-${versionSwap2[2]}`);
    candidates.add(`${versionSwap2[1]}-${versionSwap2[3]}-${versionSwap2[2].replace(/\./g, '-')}`);
  }

  // dots-as-dashes for the version portion: "3.5" -> "3-5"
  if (bare.includes('.')) {
    candidates.add(bare.replace(/\./g, '-'));
  }

  return Array.from(candidates);
}

function matchOpenRouter(
  configModel: string,
  orMap: Map<string, OpenRouterModel>
): OpenRouterModel | undefined {
  if (orMap.has(configModel)) return orMap.get(configModel);
  const lower = configModel.toLowerCase();
  if (orMap.has(lower)) return orMap.get(lower);
  const normalized = normalizeModelId(configModel);
  if (orMap.has(normalized)) return orMap.get(normalized);
  const bare = bareModelName(configModel);
  for (const [key, model] of orMap.entries()) {
    if (bareModelName(key) === bare) return model;
  }
  return undefined;
}

function matchLiteLLMPricing(
  configModel: string,
  pricing: LiteLLMPricingMap
): [string, LiteLLMPricingEntry] | undefined {
  if (pricing[configModel]) return [configModel, pricing[configModel]];
  const lower = configModel.toLowerCase();
  for (const [key, val] of Object.entries(pricing)) {
    if (key.toLowerCase() === lower) return [key, val];
  }
  const bare = bareModelName(configModel);
  for (const [key, val] of Object.entries(pricing)) {
    if (bareModelName(key) === bare) return [key, val];
  }
  return undefined;
}

function matchBenchmark(
  modelId: string,
  hfId: string | undefined,
  benchMap: Map<string, OpenLLMLeaderboardEntry>
): OpenLLMLeaderboardEntry | undefined {
  if (hfId) {
    const entry = benchMap.get(hfId.toLowerCase());
    if (entry) return entry;
  }
  const bare = bareModelName(modelId);
  return benchMap.get(bare);
}

function matchArena(
  modelId: string,
  arenaMap: Map<string, ArenaEntry>
): ArenaEntry | undefined {
  const candidates = arenaMatchCandidates(modelId);

  // Try all candidate keys against the arena map
  for (const candidate of candidates) {
    if (arenaMap.has(candidate)) return arenaMap.get(candidate);
  }

  // Fuzzy: prefix matching as last resort
  const aggressive = normalizeForArenaMatch(bareModelName(modelId));
  for (const [key, entry] of arenaMap.entries()) {
    if (key.startsWith(aggressive) || aggressive.startsWith(key)) {
      return entry;
    }
  }

  return undefined;
}

function mergeModelData(
  configEntry: LiteLLMModelEntry | null,
  orModel: OpenRouterModel | undefined,
  litellmPricing: [string, LiteLLMPricingEntry] | undefined,
  benchmark: OpenLLMLeaderboardEntry | undefined,
  arena: ArenaEntry | undefined
): MergedModel {
  const modelId = orModel?.id || configEntry?.litellm_params.model || 'unknown';
  const provider = extractProvider(modelId);
  const sources: string[] = [];

  if (configEntry) sources.push('config');
  if (orModel) sources.push('openrouter');
  if (litellmPricing) sources.push('litellm');
  if (benchmark) sources.push('openllm');
  if (arena) sources.push('arena');

  let inputPerMillion: number | null = null;
  let outputPerMillion: number | null = null;
  let cacheReadPerToken: number | null = null;
  let imageInput: number | null = null;
  let priceSource: 'openrouter' | 'litellm' | null = null;

  if (orModel?.pricing) {
    const promptPrice = parseFloat(orModel.pricing.prompt);
    const completionPrice = parseFloat(orModel.pricing.completion);
    if (!isNaN(promptPrice) && promptPrice > 0) {
      inputPerMillion = promptPrice * 1_000_000;
      priceSource = 'openrouter';
    }
    if (!isNaN(completionPrice) && completionPrice > 0) {
      outputPerMillion = completionPrice * 1_000_000;
      priceSource = 'openrouter';
    }
    if (orModel.pricing.image) {
      const imgPrice = parseFloat(orModel.pricing.image);
      if (!isNaN(imgPrice)) imageInput = imgPrice;
    }
  }

  if (litellmPricing) {
    const [, lp] = litellmPricing;
    if (inputPerMillion === null && lp.input_cost_per_token) {
      inputPerMillion = lp.input_cost_per_token * 1_000_000;
      priceSource = 'litellm';
    }
    if (outputPerMillion === null && lp.output_cost_per_token) {
      outputPerMillion = lp.output_cost_per_token * 1_000_000;
      priceSource = priceSource || 'litellm';
    }
    if (lp.cache_read_input_token_cost) {
      cacheReadPerToken = lp.cache_read_input_token_cost;
    }
  }

  const lp = litellmPricing?.[1];
  const capabilities = {
    vision: lp?.supports_vision || orModel?.architecture?.modality?.includes('image') || false,
    function_calling: lp?.supports_function_calling || false,
    reasoning: lp?.supports_reasoning || false,
    prompt_caching: lp?.supports_prompt_caching || false,
  };

  return {
    id: modelId,
    name: orModel?.name || configEntry?.model_name || bareModelName(modelId),
    litellm_model_name: configEntry?.model_name || null,
    provider,
    description: orModel?.description || null,
    context_length: orModel?.context_length || lp?.max_input_tokens || lp?.max_tokens || null,
    max_output_tokens: orModel?.top_provider?.max_completion_tokens || lp?.max_output_tokens || null,
    modality: orModel?.architecture?.modality || lp?.mode || null,
    capabilities,
    pricing: {
      input_per_million: inputPerMillion,
      output_per_million: outputPerMillion,
      cache_read_per_token: cacheReadPerToken,
      image_input: imageInput,
      price_source: priceSource,
    },
    benchmarks: {
      arena_elo: arena?.elo || arena?.rating || null,
      arena_categories: arena?.categories || null,
      ollm_average: benchmark?.average || null,
      ollm_mmlu_pro: benchmark?.mmlu_pro || null,
      ollm_gpqa: benchmark?.gpqa || null,
      ollm_math: benchmark?.math || null,
      ollm_bbh: benchmark?.bbh || null,
    },
    is_configured: !!configEntry,
    data_sources: sources,
  };
}

export interface DataSourceStatus {
  warnings: string[];
}

export async function getAllModels(): Promise<{ models: MergedModel[]; status: DataSourceStatus }> {
  const warnings: string[] = [];

  // Fetch all data sources in parallel, catching individual failures
  const [configModels, orModels, litellmPricing, benchmarks, arenaEntries] = await Promise.all([
    Promise.resolve(parseConfig()),
    fetchOpenRouterModels().catch((err) => {
      warnings.push(`OpenRouter: ${err instanceof Error ? err.message : 'failed to load'}`);
      return [] as OpenRouterModel[];
    }),
    fetchLiteLLMPricing().catch((err) => {
      warnings.push(`LiteLLM pricing: ${err instanceof Error ? err.message : 'failed to load'}`);
      return {} as LiteLLMPricingMap;
    }),
    fetchOpenLLMBenchmarks().catch((err) => {
      warnings.push(`Open LLM Leaderboard: ${err instanceof Error ? err.message : 'failed to load'}`);
      return [] as OpenLLMLeaderboardEntry[];
    }),
    fetchArenaRankings().catch((err) => {
      warnings.push(`Arena leaderboard: ${err instanceof Error ? err.message : 'failed to load'}`);
      return [] as ArenaEntry[];
    }),
  ]);

  debug('--- Data Source Summary ---');
  debug(`Config models: ${configModels.length}`);
  debug(`OpenRouter models: ${orModels.length}`);
  debug(`LiteLLM pricing entries: ${Object.keys(litellmPricing).length}`);
  debug(`Benchmark entries: ${benchmarks.length}`);
  debug(`Arena entries: ${arenaEntries.length}`);
  if (warnings.length > 0) debug(`Warnings: ${warnings.join(', ')}`);

  const orMap = buildOpenRouterMap(orModels);
  const benchMap = buildBenchmarkMap(benchmarks);
  const arenaMap = buildArenaMap(arenaEntries);

  const mergedModels = new Map<string, MergedModel>();

  debug('--- Matching Configured Models ---');
  for (const configEntry of configModels) {
    const modelParam = configEntry.litellm_params.model;

    if (modelParam.includes('*')) {
      const prefix = modelParam.replace('*', '').toLowerCase();
      let wildcardCount = 0;
      for (const orModel of orModels) {
        if (orModel.id.toLowerCase().startsWith(prefix)) {
          wildcardCount++;
          const lp = matchLiteLLMPricing(orModel.id, litellmPricing);
          const bench = matchBenchmark(orModel.id, orModel.hugging_face_id, benchMap);
          const arena = matchArena(orModel.id, arenaMap);
          mergedModels.set(orModel.id, mergeModelData(configEntry, orModel, lp, bench, arena));
        }
      }
      debug(`[wildcard] ${modelParam} -> matched ${wildcardCount} OpenRouter models`);
      continue;
    }

    const orModel = matchOpenRouter(modelParam, orMap);
    const lp = matchLiteLLMPricing(modelParam, litellmPricing);
    const bench = matchBenchmark(modelParam, orModel?.hugging_face_id, benchMap);
    const arena = matchArena(modelParam, arenaMap);
    const id = orModel?.id || modelParam;

    debug(`[${configEntry.model_name}] (${modelParam})`);
    debug(`  OpenRouter: ${orModel ? `YES -> ${orModel.id}` : 'NO'}`);
    debug(`  LiteLLM:    ${lp ? `YES -> ${lp[0]}` : 'NO'}`);
    debug(`  Benchmark:  ${bench ? `YES -> ${bench.model_name} (avg: ${bench.average})` : 'NO'}`);
    debug(`  Arena:      ${arena ? `YES -> ${arena.name} (elo: ${arena.elo || arena.rating})` : 'NO'}`);

    mergedModels.set(id, mergeModelData(configEntry, orModel, lp, bench, arena));
  }

  let unconfiguredCount = 0;
  for (const orModel of orModels) {
    if (!mergedModels.has(orModel.id)) {
      unconfiguredCount++;
      const lp = matchLiteLLMPricing(orModel.id, litellmPricing);
      const bench = matchBenchmark(orModel.id, orModel.hugging_face_id, benchMap);
      const arena = matchArena(orModel.id, arenaMap);
      mergedModels.set(orModel.id, mergeModelData(null, orModel, lp, bench, arena));
    }
  }

  debug('--- Results Summary ---');
  debug(`Configured models matched: ${configModels.length}`);
  debug(`Unconfigured OpenRouter models added: ${unconfiguredCount}`);
  debug(`Total merged models: ${mergedModels.size}`);

  return {
    models: Array.from(mergedModels.values()),
    status: { warnings },
  };
}

export async function getModelById(id: string): Promise<MergedModel | undefined> {
  const { models } = await getAllModels();
  return models.find((m) => m.id === id);
}
