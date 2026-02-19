export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  architecture?: {
    modality?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
}

export interface OpenRouterResponse {
  data: OpenRouterModel[];
}
