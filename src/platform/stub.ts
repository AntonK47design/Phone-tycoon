import type { Platform } from './platform';

const log = import.meta.env.DEV ? (...a: unknown[]) => console.debug('[platform:stub]', ...a) : () => {};

function safeStorage() {
  return {
    get(key: string) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* storage blocked – game stays playable without saves */
      }
    },
    remove(key: string) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function createStubPlatform(): Platform {
  return {
    name: 'stub',
    loadingStart: () => log('loadingStart'),
    loadingStop: () => log('loadingStop'),
    gameplayStart: () => log('gameplayStart'),
    gameplayStop: () => log('gameplayStop'),
    happytime: () => log('happytime'),
    requestAd: async (type) => {
      log('requestAd', type);
      return 'unavailable';
    },
    hasAdblock: async () => false,
    data: safeStorage(),
  };
}

export { safeStorage };
