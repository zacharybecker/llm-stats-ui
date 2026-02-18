import axios from 'axios';
import { OpenRouterModel, OpenRouterResponse } from '../types/openrouter';
import { getCached, setCached } from './cache';
import { env } from '../config/env';

const CACHE_KEY = 'openrouter_models';
const API_URL = 'https://openrouter.ai/api/v1/models';

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const cached = getCached<OpenRouterModel[]>(CACHE_KEY);
  if (cached) return cached;

  try {
    const response = await axios.get<OpenRouterResponse>(API_URL, {
      timeout: 15000,
      headers: { 'Accept': 'application/json' },
    });

    const models = response.data.data || [];
    setCached(CACHE_KEY, models, env.OPENROUTER_CACHE_TTL);
    console.log(`Fetched ${models.length} models from OpenRouter`);
    return models;
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error instanceof Error ? error.message : error);
    return [];
  }
}

export function buildOpenRouterMap(models: OpenRouterModel[]): Map<string, OpenRouterModel> {
  const map = new Map<string, OpenRouterModel>();
  for (const model of models) {
    map.set(model.id, model);
    // Also map by lowercase
    map.set(model.id.toLowerCase(), model);
  }
  return map;
}
