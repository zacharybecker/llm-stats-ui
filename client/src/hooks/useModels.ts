import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchModels, fetchModelById, fetchPricing, fetchBenchmarks, refreshConfig, fetchUIConfig } from '../services/api';

export function useModels(params?: {
  provider?: string;
  sort?: string;
  search?: string;
  include_unconfigured?: boolean;
}) {
  return useQuery({
    queryKey: ['models', params],
    queryFn: () => fetchModels(params),
    staleTime: 60_000,
  });
}

export function useModelById(id: string) {
  return useQuery({
    queryKey: ['model', id],
    queryFn: () => fetchModelById(id),
    enabled: !!id,
  });
}

export function usePricing(params?: {
  sort?: string;
  input_tokens?: number;
  output_tokens?: number;
  requests?: number;
  include_unconfigured?: boolean;
}) {
  return useQuery({
    queryKey: ['pricing', params],
    queryFn: () => fetchPricing(params),
    staleTime: 60_000,
  });
}

export function useBenchmarks(params?: {
  category?: 'text' | 'code' | 'vision' | 'all';
  include_unconfigured?: boolean;
}) {
  return useQuery({
    queryKey: ['benchmarks', params],
    queryFn: () => fetchBenchmarks(params),
    staleTime: 60_000,
  });
}

export function useRefreshConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshConfig,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useUIConfig() {
  return useQuery({
    queryKey: ['ui-config'],
    queryFn: fetchUIConfig,
    staleTime: Infinity,
  });
}
