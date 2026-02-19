import { ArenaScore } from './benchmarks';

export interface MergedModel {
  id: string;
  name: string;
  litellm_model_name: string | null;
  provider: string;
  description: string | null;
  context_length: number | null;
  max_output_tokens: number | null;
  modality: string | null;
  capabilities: {
    vision: boolean;
    function_calling: boolean;
    reasoning: boolean;
    prompt_caching: boolean;
  };
  pricing: {
    input_per_million: number | null;
    output_per_million: number | null;
    cache_read_per_token: number | null;
    image_input: number | null;
    price_source: 'openrouter' | 'litellm' | null;
  };
  benchmarks: {
    arena_text: ArenaScore | null;
    arena_code: ArenaScore | null;
    arena_vision: ArenaScore | null;

  };
  is_configured: boolean;
  data_sources: string[];
}
