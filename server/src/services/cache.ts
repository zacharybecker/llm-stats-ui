import NodeCache from 'node-cache';

const cache = new NodeCache({ checkperiod: 120 });

export function getCached<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCached<T>(key: string, value: T, ttl: number): void {
  cache.set(key, value, ttl);
}

export function flushAll(): void {
  cache.flushAll();
}
