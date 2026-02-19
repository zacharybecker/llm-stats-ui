import axios from 'axios';
import { MergedModel, ModelsResponse } from '../types/models';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export async function fetchModels(params?: {
  provider?: string;
  sort?: string;
  search?: string;
  configured_only?: boolean;
  include_unconfigured?: boolean;
}): Promise<ModelsResponse> {
  const { data } = await api.get<ModelsResponse>('/models', { params });
  return data;
}

export async function fetchModelById(id: string): Promise<MergedModel> {
  const { data } = await api.get<MergedModel>(`/models/${id}`);
  return data;
}

export async function fetchPricing(params?: {
  sort?: string;
  input_tokens?: number;
  output_tokens?: number;
  requests?: number;
  include_unconfigured?: boolean;
}): Promise<ModelsResponse> {
  const { data } = await api.get<ModelsResponse>('/pricing', { params });
  return data;
}

export async function fetchBenchmarks(params?: {
  source?: 'arena' | 'openllm' | 'all';
  category?: string;
  include_unconfigured?: boolean;
}): Promise<ModelsResponse> {
  const { data } = await api.get<ModelsResponse>('/benchmarks', { params });
  return data;
}

export async function refreshConfig(): Promise<{ status: string; models_loaded: number }> {
  const { data } = await api.post('/config/refresh');
  return data;
}

export async function fetchHealth(): Promise<{
  status: string;
  total_models: number;
  configured_models: number;
}> {
  const { data } = await api.get('/health');
  return data;
}
