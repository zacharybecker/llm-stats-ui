import { useCallback, useSyncExternalStore } from 'react';

const SHOW_ALL_MODELS_KEY = 'llm-stats-show-all-models';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(SHOW_ALL_MODELS_KEY) === 'true';
  } catch {
    return false;
  }
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function useShowAllModels(): [boolean, (value: boolean) => void] {
  const showAll = useSyncExternalStore(subscribe, getSnapshot);

  const setShowAll = useCallback((value: boolean) => {
    try {
      localStorage.setItem(SHOW_ALL_MODELS_KEY, String(value));
    } catch {
      // ignore storage errors
    }
    notify();
  }, []);

  return [showAll, setShowAll];
}
