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
    candidates(key: string): string[] {
      const v = this.get(key);
      return v ? [v] : [];
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
    requestAd: async (type, hooks) => {
      log('requestAd', type);
      if (!import.meta.env.DEV) return 'unavailable';
      // Dev only: a fake 1.5 s ad so the ad flow (pause, mute, reward) can be tested.
      hooks?.onStart?.();
      const el = document.createElement('div');
      el.className = 'fake-ad';
      el.textContent = `${type} ad (dev)`;
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 1500));
      el.remove();
      return 'finished';
    },
    hasAdblock: async () => false,
    data: safeStorage(),
  };
}

export { safeStorage };
