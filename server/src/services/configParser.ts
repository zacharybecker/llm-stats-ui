import fs from 'fs';
import yaml from 'js-yaml';
import { LiteLLMConfig, LiteLLMModelEntry } from '../types/litellm';
import { env } from '../config/env';

export function parseConfig(configPath?: string): LiteLLMModelEntry[] {
  const path = configPath || env.CONFIG_PATH;

  try {
    if (!fs.existsSync(path)) {
      console.warn(`Config file not found at ${path}, returning empty model list`);
      return [];
    }

    const fileContents = fs.readFileSync(path, 'utf8');
    const config = yaml.load(fileContents) as LiteLLMConfig;

    if (!config || !config.model_list) {
      console.warn('No model_list found in config');
      return [];
    }

    return config.model_list;
  } catch (error) {
    console.error('Error parsing config:', error);
    return [];
  }
}
