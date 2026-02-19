export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CONFIG_PATH: process.env.CONFIG_PATH || '/app/config/config.yaml',
  OPENROUTER_CACHE_TTL: parseInt(process.env.OPENROUTER_CACHE_TTL || '300', 10),
  DEBUG: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
  APP_NAME: process.env.APP_NAME || 'Model Stats',
  OLLAMA_FREE: process.env.OLLAMA_FREE !== 'false' && process.env.OLLAMA_FREE !== '0',
};
