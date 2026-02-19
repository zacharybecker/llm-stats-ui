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

export async function refreshConfig(): Promise<{ status: string; models_loaded: number }> {
  const { data } = await api.post('/config/refresh');
  return data;
}

export async function fetchUIConfig(): Promise<{ appName: string }> {
  const { data } = await api.get('/config/ui');
  return data;
}
