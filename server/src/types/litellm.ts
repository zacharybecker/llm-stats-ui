export interface LiteLLMConfig {
  model_list?: LiteLLMModelEntry[];
  litellm_settings?: Record<string, unknown>;
  general_settings?: Record<string, unknown>;
}

export interface LiteLLMModelEntry {
  model_name: string;
  litellm_params: {
    model: string;
    api_key?: string;
    api_base?: string;
    [key: string]: unknown;
  };
  model_info?: {
    id?: string;
    [key: string]: unknown;
  };
}

export interface LiteLLMPricingEntry {
  max_tokens?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  output_cost_per_token?: number;
  input_cost_per_token?: number;
  cache_read_input_token_cost?: number;
  litellm_provider?: string;
  mode?: string;
  supports_function_calling?: boolean;
  supports_vision?: boolean;
  supports_prompt_caching?: boolean;
  supports_reasoning?: boolean;
  supports_tool_choice?: boolean;
  [key: string]: unknown;
}

export type LiteLLMPricingMap = Record<string, LiteLLMPricingEntry>;
