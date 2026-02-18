import axios from 'axios';
import { LiteLLMPricingMap } from '../types/litellm';
import { getCached, setCached } from './cache';
import { env } from '../config/env';

const CACHE_KEY = 'litellm_pricing';
const PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

export async function fetchLiteLLMPricing(): Promise<LiteLLMPricingMap> {
  const cached = getCached<LiteLLMPricingMap>(CACHE_KEY);
  if (cached) return cached;

  try {
    const response = await axios.get<LiteLLMPricingMap>(PRICING_URL, {
      timeout: 15000,
    });

    const pricing = response.data || {};
    // Remove the sample_spec entry if present
    delete pricing['sample_spec'];
    setCached(CACHE_KEY, pricing, env.LITELLM_PRICING_CACHE_TTL);
    console.log(`Fetched ${Object.keys(pricing).length} entries from LiteLLM pricing`);
    return pricing;
  } catch (error) {
    console.error('Error fetching LiteLLM pricing:', error instanceof Error ? error.message : error);
    return {};
  }
}
