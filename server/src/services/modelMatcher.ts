import { LiteLLMModelEntry, LiteLLMPricingMap, LiteLLMPricingEntry } from '../types/litellm';
import { OpenRouterModel } from '../types/openrouter';
import { OpenLLMLeaderboardEntry, ArenaEntry } from '../types/benchmarks';
import { MergedModel } from '../types/models';
import { parseConfig } from './configParser';
import { fetchOpenRouterModels, buildOpenRouterMap } from './openRouterClient';
import { fetchLiteLLMPricing } from './litellmPricing';
import { fetchOpenLLMBenchmarks, buildBenchmarkMap } from './benchmarkScraper';
import { fetchArenaRankings, buildArenaMap } from './arenaScraper';

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

function matchOpenRouter(
  configModel: string,
  orMap: Map<string, OpenRouterModel>
): OpenRouterModel | undefined {
  // Direct match
  if (orMap.has(configModel)) return orMap.get(configModel);
  // Lowercase match
  const lower = configModel.toLowerCase();
  if (orMap.has(lower)) return orMap.get(lower);
  // Normalized match
  const normalized = normalizeModelId(configModel);
  if (orMap.has(normalized)) return orMap.get(normalized);
  // Try without provider prefix for matching
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
  // Direct match
  if (pricing[configModel]) return [configModel, pricing[configModel]];
  // Lowercase match
  const lower = configModel.toLowerCase();
  for (const [key, val] of Object.entries(pricing)) {
    if (key.toLowerCase() === lower) return [key, val];
  }
  // Bare model name match
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
  // Try HuggingFace ID from OpenRouter
  if (hfId) {
    const entry = benchMap.get(hfId.toLowerCase());
    if (entry) return entry;
  }
  // Try bare model name
  const bare = bareModelName(modelId);
  return benchMap.get(bare);
}

function matchArena(
  modelId: string,
  arenaMap: Map<string, ArenaEntry>
): ArenaEntry | undefined {
  const bare = bareModelName(modelId);
  const normalized = normalizeModelId(bare);

  // Direct match attempts
  if (arenaMap.has(bare)) return arenaMap.get(bare);
  if (arenaMap.has(normalized)) return arenaMap.get(normalized);

  // Try without "-instruct" suffix
  const noInstruct = bare.replace(/-instruct$/, '');
  if (noInstruct !== bare && arenaMap.has(noInstruct)) return arenaMap.get(noInstruct);

  // Try with dots replaced by dashes and vice versa
  const dotsAsDashes = bare.replace(/\./g, '-');
  if (dotsAsDashes !== bare && arenaMap.has(dotsAsDashes)) return arenaMap.get(dotsAsDashes);
  const dashesAsDots = bare.replace(/-/g, '.');
  if (dashesAsDots !== bare && arenaMap.has(dashesAsDots)) return arenaMap.get(dashesAsDots);

  // Try common name mappings
  const nameMap: Record<string, string[]> = {
    'gpt-4o': ['gpt-4o', 'gpt-4o-2024'],
    'gpt-4-turbo': ['gpt-4-turbo', 'gpt-4-1106'],
    'claude-3.5-sonnet': ['claude-3-5-sonnet', 'claude-3.5-sonnet'],
    'claude-3-opus': ['claude-3-opus'],
    'gemini-pro-1.5': ['gemini-1.5-pro', 'gemini-pro'],
    'gemini-2.0-flash-001': ['gemini-2.0-flash'],
    'grok-2-1212': ['grok-2'],
    'mistral-large-2411': ['mistral-large'],
  };

  for (const [, aliases] of Object.entries(nameMap)) {
    if (aliases.includes(bare) || aliases.includes(normalized)) {
      for (const alias of aliases) {
        if (arenaMap.has(alias)) return arenaMap.get(alias);
      }
    }
  }

  // Fuzzy: try prefix matching (find arena entry that starts with normalized bare name)
  for (const [key, entry] of arenaMap.entries()) {
    if (key.startsWith(normalized) || normalized.startsWith(key)) {
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

  // Pricing: OpenRouter takes priority, fallback to LiteLLM
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

  // Capabilities: LiteLLM pricing has the best data
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

export async function getAllModels(): Promise<MergedModel[]> {
  // Fetch all data sources in parallel
  const [configModels, orModels, litellmPricing, benchmarks, arenaEntries] = await Promise.all([
    Promise.resolve(parseConfig()),
    fetchOpenRouterModels(),
    fetchLiteLLMPricing(),
    fetchOpenLLMBenchmarks(),
    fetchArenaRankings(),
  ]);

  const orMap = buildOpenRouterMap(orModels);
  const benchMap = buildBenchmarkMap(benchmarks);
  const arenaMap = buildArenaMap(arenaEntries);

  const mergedModels = new Map<string, MergedModel>();

  // First pass: process configured models
  for (const configEntry of configModels) {
    const modelParam = configEntry.litellm_params.model;

    // Handle wildcard entries like "anthropic/*"
    if (modelParam.includes('*')) {
      const prefix = modelParam.replace('*', '').toLowerCase();
      for (const orModel of orModels) {
        if (orModel.id.toLowerCase().startsWith(prefix)) {
          const lp = matchLiteLLMPricing(orModel.id, litellmPricing);
          const bench = matchBenchmark(orModel.id, orModel.hugging_face_id, benchMap);
          const arena = matchArena(orModel.id, arenaMap);
          mergedModels.set(orModel.id, mergeModelData(configEntry, orModel, lp, bench, arena));
        }
      }
      continue;
    }

    const orModel = matchOpenRouter(modelParam, orMap);
    const lp = matchLiteLLMPricing(modelParam, litellmPricing);
    const bench = matchBenchmark(modelParam, orModel?.hugging_face_id, benchMap);
    const arena = matchArena(modelParam, arenaMap);
    const id = orModel?.id || modelParam;
    mergedModels.set(id, mergeModelData(configEntry, orModel, lp, bench, arena));
  }

  // Second pass: add all OpenRouter models that weren't in config (not configured)
  for (const orModel of orModels) {
    if (!mergedModels.has(orModel.id)) {
      const lp = matchLiteLLMPricing(orModel.id, litellmPricing);
      const bench = matchBenchmark(orModel.id, orModel.hugging_face_id, benchMap);
      const arena = matchArena(orModel.id, arenaMap);
      mergedModels.set(orModel.id, mergeModelData(null, orModel, lp, bench, arena));
    }
  }

  return Array.from(mergedModels.values());
}

export async function getModelById(id: string): Promise<MergedModel | undefined> {
  const allModels = await getAllModels();
  return allModels.find((m) => m.id === id);
}
