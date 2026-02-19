import { LiteLLMModelEntry } from '../types/litellm';
import { OpenRouterModel } from '../types/openrouter';
import { MergedModel } from '../types/models';
import { parseConfig } from './configParser';
import { fetchOpenRouterModels, buildOpenRouterMap } from './openRouterClient';
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
 * e.g. "ollama/gemma3:4b" -> "google/gemma-3-4b-it"
 *      "ollama/mistral"   -> "mistralai/mistral-7b-instruct"
 */
function matchOllamaToOpenRouter(
  ollamaModel: string,
  orMap: Map<string, OpenRouterModel>
): OpenRouterModel | undefined {
  const afterPrefix = ollamaModel.replace(/^ollama\//, '');
  const [family, sizeTag] = afterPrefix.split(':');

  // Normalize family: insert hyphens at letter-digit boundaries
  // gemma3 -> gemma-3, llama3 -> llama-3, mistral -> mistral
  const normalizedFamily = family
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')
    .toLowerCase();

  const candidates: { model: OpenRouterModel; score: number }[] = [];

  for (const [, model] of orMap.entries()) {
    const orBare = bareModelName(model.id).toLowerCase();

    // Must contain the family name
    if (!orBare.includes(normalizedFamily)) continue;

    // If size tag specified (e.g. "4b"), must contain it
    if (sizeTag && !orBare.includes(sizeTag.toLowerCase())) continue;

    let score = 0;
    // Prefer instruct/chat variants (more useful metadata)
    if (orBare.includes('instruct') || orBare.includes('it') || orBare.includes('chat')) score += 2;
    // Prefer non-free entries (tend to have richer metadata)
    if (!model.id.includes(':free')) score += 1;
    // Prefer shorter names (more likely the canonical version)
    score -= orBare.length * 0.01;

    candidates.push({ model, score });
  }

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => b.score - a.score);
  debug(`  Ollama fuzzy match: ${ollamaModel} -> ${candidates[0].model.id} (${candidates.length} candidates)`);
  return candidates[0].model;
}

function mergeModelData(
  configEntry: LiteLLMModelEntry | null,
  orModel: OpenRouterModel | undefined
): MergedModel {
  const modelId = orModel?.id || configEntry?.litellm_params.model || 'unknown';
  const provider = configEntry ? extractProvider(configEntry.litellm_params.model) : extractProvider(modelId);
  const sources: string[] = [];

  if (configEntry) sources.push('config');
  if (orModel) sources.push('openrouter');

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
    benchmarks: {},
    is_configured: !!configEntry,
    data_sources: sources,
  };
}

export interface DataSourceStatus {
  warnings: string[];
}

export async function getAllModels(includeUnconfigured: boolean = false): Promise<{ models: MergedModel[]; status: DataSourceStatus }> {
  const warnings: string[] = [];

  const [configModels, orModels] = await Promise.all([
    Promise.resolve().then(() => parseConfig()),
    fetchOpenRouterModels().catch((err) => {
      warnings.push(`OpenRouter: ${err instanceof Error ? err.message : 'failed to load'}`);
      return [] as OpenRouterModel[];
    }),
  ]);

  debug('--- Data Source Summary ---');
  debug(`Config models: ${configModels.length}`);
  debug(`OpenRouter models: ${orModels.length}`);
  if (warnings.length > 0) debug(`Warnings: ${warnings.join(', ')}`);

  const orMap = buildOpenRouterMap(orModels);

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
          mergedModels.set(orModel.id, mergeModelData(configEntry, orModel));
        }
      }
      debug(`[wildcard] ${modelParam} -> matched ${wildcardCount} OpenRouter models`);
      continue;
    }

    let orModel = matchOpenRouter(modelParam, orMap);
    let ollamaFuzzy = false;

    // For Ollama models, try fuzzy matching against OpenRouter to pull in
    // context length, capabilities, and description from the base model
    if (!orModel && extractProvider(modelParam) === 'ollama') {
      orModel = matchOllamaToOpenRouter(modelParam, orMap);
      if (orModel) ollamaFuzzy = true;
    }

    const merged = mergeModelData(configEntry, orModel);

    // For Ollama fuzzy matches, keep the original model identity
    if (ollamaFuzzy) {
      merged.id = modelParam;
    }

    const id = merged.id;

    debug(`[${configEntry.model_name}] (${modelParam})`);
    debug(`  OpenRouter: ${orModel ? `YES -> ${orModel.id}${ollamaFuzzy ? ' (fuzzy)' : ''}` : 'NO'}`);

    mergedModels.set(id, merged);
  }

  let unconfiguredCount = 0;
  if (includeUnconfigured) {
    for (const orModel of orModels) {
      if (!mergedModels.has(orModel.id)) {
        unconfiguredCount++;
        mergedModels.set(orModel.id, mergeModelData(null, orModel));
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
