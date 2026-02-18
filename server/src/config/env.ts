export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CONFIG_PATH: process.env.CONFIG_PATH || '/app/config/config.yaml',
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '300', 10),
  OPENROUTER_CACHE_TTL: parseInt(process.env.OPENROUTER_CACHE_TTL || '300', 10),
  LITELLM_PRICING_CACHE_TTL: parseInt(process.env.LITELLM_PRICING_CACHE_TTL || '1800', 10),
  BENCHMARK_CACHE_TTL: parseInt(process.env.BENCHMARK_CACHE_TTL || '3600', 10),
  ARENA_CACHE_TTL: parseInt(process.env.ARENA_CACHE_TTL || '1800', 10),
  DEBUG: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
};
