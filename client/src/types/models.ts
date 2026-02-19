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
    image_input: number | null;
  };
  benchmarks: Record<string, never>;
  is_configured: boolean;
  data_sources: string[];
  calculated_cost?: {
    input_cost: number | null;
    output_cost: number | null;
    total_cost: number | null;
  };
}

export interface ModelsResponse {
  data: MergedModel[];
  total: number;
  warnings?: string[];
}
