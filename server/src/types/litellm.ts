export interface LiteLLMConfig {
  model_list?: LiteLLMModelEntry[];
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
