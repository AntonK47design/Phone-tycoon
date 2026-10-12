// CrazyGames HTML5 SDK v3 adapter with stub fallback (PLAN §6).

import type { AdOutcome, Platform } from './platform';
import { createStubPlatform, safeStorage } from './stub';

interface CgSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
  };
  ad: {
    requestAd(type: 'midgame' | 'rewarded', cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void;
    hasAdblock(): Promise<boolean>;
  };
  data?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CgSdk };
  }
}

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

function loadScript(timeoutMs: number): Promise<CgSdk | null> {
  if (window.CrazyGames?.SDK) return Promise.resolve(window.CrazyGames.SDK);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const script = existing ?? document.createElement('script');
    const done = (sdk: CgSdk | null) => {
      clearTimeout(timer);
      resolve(sdk);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    script.addEventListener('load', () => done(window.CrazyGames?.SDK ?? null));
    script.addEventListener('error', () => done(null));
    if (!existing) {
      script.src = SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

/** Initializes the SDK; falls back to the stub outside local/crazygames environments. */
export async function createPlatform(): Promise<Platform> {
  const sdk = await loadScript(4000).catch(() => null);
  if (!sdk) return createStubPlatform();
  try {
    await sdk.init();
  } catch {
    return createStubPlatform();
  }
  if (sdk.environment !== 'local' && sdk.environment !== 'crazygames') return createStubPlatform();

  const local = safeStorage();
  const data = sdk.data
    ? {
        get: (k: string) => {
          try {
            return sdk.data!.getItem(k);
          } catch {
            return local.get(k);
          }
        },
        set: (k: string, v: string) => {
          try {
            sdk.data!.setItem(k, v);
          } catch {
            /* fall through */
          }
          local.set(k, v);
        },
        remove: (k: string) => {
          try {
            sdk.data!.removeItem(k);
          } catch {
            /* ignore */
          }
          local.remove(k);
        },
      }
    : local;

  return {
    name: 'crazygames',
    loadingStart: () => sdk.game.loadingStart(),
    loadingStop: () => sdk.game.loadingStop(),
    gameplayStart: () => sdk.game.gameplayStart(),
    gameplayStop: () => sdk.game.gameplayStop(),
    happytime: () => sdk.game.happytime(),
    requestAd: (type, hooks) =>
      new Promise<AdOutcome>((resolve) => {
        try {
          sdk.ad.requestAd(type, {
            adStarted: () => hooks?.onStart?.(),
            adFinished: () => resolve('finished'),
            adError: () => resolve('error'),
          });
        } catch {
          resolve('error');
        }
      }),
    hasAdblock: () => sdk.ad.hasAdblock().catch(() => false),
    data,
  };
}
