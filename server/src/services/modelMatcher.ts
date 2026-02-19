import { LiteLLMModelEntry } from '../types/litellm';
import { OpenRouterModel } from '../types/openrouter';
import { LMArenaEntry, ArenaScore } from '../types/benchmarks';
import { MergedModel } from '../types/models';
import { parseConfig } from './configParser';
import { fetchOpenRouterModels, buildOpenRouterMap } from './openRouterClient';
import { fetchLMArenaData, buildLMArenaMap } from './lmarenaScraper';
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
  let bare = parts[parts.length - 1].toLowerCase();
  bare = bare.replace(/^(us|eu|apac|global)\./, '');
  // Strip Bedrock-style provider prefixes: "anthropic.claude-..." → "claude-..."
  bare = bare.replace(/^(anthropic|meta|amazon|cohere|mistral|ai21)\./i, '');
  // Strip Bedrock version suffixes: "-v1:0", "-v2:0"
  bare = bare.replace(/-v\d+:\d+$/, '');
  // Strip Ollama size tags: "gemma3:4b" → "gemma3"
  bare = bare.replace(/:\w+$/, '');
  return bare;
}

function extractProvider(modelId: string): string {
  const parts = modelId.split('/');
  return parts.length > 1 ? parts[0] : 'unknown';
}

/**
 * Aggressively normalize a model name for fuzzy arena matching.
 */
function normalizeForArenaMatch(name: string): string {
  return normalizeModelId(name)
    .replace(/-instruct$/, '')
    .replace(/-chat$/, '')
    .replace(/-hf$/, '')
    .replace(/-online$/, '')
    .replace(/-\d{4}$/, '')
    .replace(/-exp$/, '')
    .replace(/-0\d{2}$/, '')
    .replace(/\./g, '-');
}

/**
 * Generate candidate keys from a model name for arena lookup.
 */
function arenaMatchCandidates(modelId: string): string[] {
  const bare = bareModelName(modelId);
  const normalized = normalizeModelId(bare);
  const aggressive = normalizeForArenaMatch(bare);

  const candidates = new Set<string>();
  candidates.add(bare);
  candidates.add(normalized);
  candidates.add(aggressive);

  for (const v of [bare, normalized]) {
    candidates.add(v.replace(/\./g, '-'));
    candidates.add(v.replace(/-/g, '.'));
  }

  const hyphenated = bare
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([a-zA-Z])/g, '$1-$2');
  if (hyphenated !== bare) {
    candidates.add(hyphenated);
    candidates.add(normalizeForArenaMatch(hyphenated));
  }

  const afterSlash = modelId.split('/').pop() || '';
  const colonIdx = afterSlash.indexOf(':');
  if (colonIdx > -1) {
    const family = afterSlash.substring(0, colonIdx).toLowerCase();
    const tag = afterSlash.substring(colonIdx + 1).toLowerCase();
    const familyNorm = family
      .replace(/([a-zA-Z])(\d)/g, '$1-$2')
      .replace(/(\d)([a-zA-Z])/g, '$1-$2');
    candidates.add(`${familyNorm}-${tag}`);
    candidates.add(`${familyNorm}-${tag}-it`);
    candidates.add(`${familyNorm}-${tag}-instruct`);
  }

  const noDate8 = bare.replace(/-\d{8}$/, '');
  if (noDate8 !== bare) candidates.add(noDate8);

  const noDate4 = bare.replace(/-\d{4}$/, '');
  if (noDate4 !== bare) candidates.add(noDate4);

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

/**
 * Fuzzy-match an Ollama model name to an OpenRouter model.
 */
function matchOllamaToOpenRouter(
  ollamaModel: string,
  orMap: Map<string, OpenRouterModel>
): OpenRouterModel | undefined {
  const afterPrefix = ollamaModel.replace(/^ollama\//, '');
  const [family, sizeTag] = afterPrefix.split(':');

  const normalizedFamily = family
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')
    .toLowerCase();

  const candidates: { model: OpenRouterModel; score: number }[] = [];

  for (const [, model] of orMap.entries()) {
    const orBare = bareModelName(model.id).toLowerCase();

    if (!orBare.includes(normalizedFamily)) continue;
    if (sizeTag && !orBare.includes(sizeTag.toLowerCase())) continue;

    let score = 0;
    if (orBare.includes('instruct') || orBare.includes('it') || orBare.includes('chat')) score += 2;
    if (!model.id.includes(':free')) score += 1;
    score -= orBare.length * 0.01;

    candidates.push({ model, score });
  }

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => b.score - a.score);
  debug(`  Ollama fuzzy match: ${ollamaModel} -> ${candidates[0].model.id} (${candidates.length} candidates)`);
  return candidates[0].model;
}

function matchArena(
  modelId: string,
  arenaMap: Map<string, LMArenaEntry>
): LMArenaEntry | undefined {
  const candidates = arenaMatchCandidates(modelId);

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

function entryToScore(entry: LMArenaEntry): ArenaScore {
  return {
    rating: entry.rating,
    rating_upper: entry.ratingUpper,
    rating_lower: entry.ratingLower,
    rank: entry.rank,
    votes: entry.votes,
  };
}

function mergeModelData(
  configEntry: LiteLLMModelEntry | null,
  orModel: OpenRouterModel | undefined,
  arenaText: LMArenaEntry | undefined,
  arenaCode: LMArenaEntry | undefined,
  arenaVision: LMArenaEntry | undefined
): MergedModel {
  const modelId = orModel?.id || configEntry?.litellm_params.model || 'unknown';
  const provider = configEntry ? extractProvider(configEntry.litellm_params.model) : extractProvider(modelId);
  const sources: string[] = [];

  if (configEntry) sources.push('config');
  if (orModel) sources.push('openrouter');
  if (arenaText || arenaCode || arenaVision) sources.push('lmarena');

  let inputPerMillion: number | null = null;
  let outputPerMillion: number | null = null;
  let imageInput: number | null = null;

  if (orModel?.pricing) {
    const promptPrice = parseFloat(orModel.pricing.prompt);
    const completionPrice = parseFloat(orModel.pricing.completion);
    if (!isNaN(promptPrice) && promptPrice > 0) {
      inputPerMillion = promptPrice * 1_000_000;
    }
    if (!isNaN(completionPrice) && completionPrice > 0) {
      outputPerMillion = completionPrice * 1_000_000;
    }
    if (orModel.pricing.image) {
      const imgPrice = parseFloat(orModel.pricing.image);
      if (!isNaN(imgPrice)) imageInput = imgPrice;
    }
  }

  // Mark Ollama models as free (they run locally)
  if (env.OLLAMA_FREE && provider === 'ollama') {
    inputPerMillion = 0;
    outputPerMillion = 0;
  }

  const capabilities = {
    vision: orModel?.architecture?.modality?.includes('image') || false,
    function_calling: false,
    reasoning: false,
    prompt_caching: false,
  };

  return {
    id: modelId,
    name: orModel?.name || configEntry?.model_name || bareModelName(modelId),
    litellm_model_name: configEntry?.model_name || null,
    provider,
    description: orModel?.description || null,
    context_length: orModel?.context_length || null,
    max_output_tokens: orModel?.top_provider?.max_completion_tokens || null,
    modality: orModel?.architecture?.modality || null,
    capabilities,
    pricing: {
      input_per_million: inputPerMillion,
      output_per_million: outputPerMillion,
      image_input: imageInput,
    },
    benchmarks: {
      arena_text: arenaText ? entryToScore(arenaText) : null,
      arena_code: arenaCode ? entryToScore(arenaCode) : null,
      arena_vision: arenaVision ? entryToScore(arenaVision) : null,
    },
    is_configured: !!configEntry,
    data_sources: sources,
  };
}

export interface DataSourceStatus {
  warnings: string[];
}

export async function getAllModels(includeUnconfigured: boolean = false): Promise<{ models: MergedModel[]; status: DataSourceStatus }> {
  const warnings: string[] = [];

  const [configModels, orModels, arenaData] = await Promise.all([
    Promise.resolve().then(() => parseConfig()),
    fetchOpenRouterModels().catch((err) => {
      warnings.push(`OpenRouter: ${err instanceof Error ? err.message : 'failed to load'}`);
      return [] as OpenRouterModel[];
    }),
    fetchLMArenaData().then((data) => {
      const emptyCats = (['text', 'code', 'vision'] as const).filter((c) => data[c].length === 0);
      if (emptyCats.length > 0) {
        warnings.push(`LMArena: no data for ${emptyCats.join(', ')}`);
      }
      return data;
    }),
  ]);

  debug('--- Data Source Summary ---');
  debug(`Config models: ${configModels.length}`);
  debug(`OpenRouter models: ${orModels.length}`);
  debug(`LMArena text: ${arenaData.text.length}, code: ${arenaData.code.length}, vision: ${arenaData.vision.length}`);
  if (warnings.length > 0) debug(`Warnings: ${warnings.join(', ')}`);

  const orMap = buildOpenRouterMap(orModels);
  const arenaTextMap = buildLMArenaMap(arenaData.text);
  const arenaCodeMap = buildLMArenaMap(arenaData.code);
  const arenaVisionMap = buildLMArenaMap(arenaData.vision);

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
          const at = matchArena(orModel.id, arenaTextMap);
          const ac = matchArena(orModel.id, arenaCodeMap);
          const av = matchArena(orModel.id, arenaVisionMap);
          mergedModels.set(orModel.id, mergeModelData(configEntry, orModel, at, ac, av));
        }
      }
      debug(`[wildcard] ${modelParam} -> matched ${wildcardCount} OpenRouter models`);
      continue;
    }

    let orModel = matchOpenRouter(modelParam, orMap);
    let ollamaFuzzy = false;

    if (!orModel && extractProvider(modelParam) === 'ollama') {
      orModel = matchOllamaToOpenRouter(modelParam, orMap);
      if (orModel) ollamaFuzzy = true;
    }

    const at = matchArena(modelParam, arenaTextMap);
    const ac = matchArena(modelParam, arenaCodeMap);
    const av = matchArena(modelParam, arenaVisionMap);
    const merged = mergeModelData(configEntry, orModel, at, ac, av);

    if (ollamaFuzzy) {
      merged.id = modelParam;
    }

    const id = merged.id;

    debug(`[${configEntry.model_name}] (${modelParam})`);
    debug(`  OpenRouter: ${orModel ? `YES -> ${orModel.id}${ollamaFuzzy ? ' (fuzzy)' : ''}` : 'NO'}`);
    debug(`  Arena Text: ${at ? `YES -> ${at.modelDisplayName} (${at.rating})` : 'NO'}`);
    debug(`  Arena Code: ${ac ? `YES -> ${ac.modelDisplayName} (${ac.rating})` : 'NO'}`);

    mergedModels.set(id, merged);
  }

  let unconfiguredCount = 0;
  if (includeUnconfigured) {
    for (const orModel of orModels) {
      if (!mergedModels.has(orModel.id)) {
        unconfiguredCount++;
        const at = matchArena(orModel.id, arenaTextMap);
        const ac = matchArena(orModel.id, arenaCodeMap);
        const av = matchArena(orModel.id, arenaVisionMap);
        mergedModels.set(orModel.id, mergeModelData(null, orModel, at, ac, av));
      }
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
  const { models } = await getAllModels(true);
  return models.find((m) => m.id === id);
}
