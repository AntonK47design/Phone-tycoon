// Platform abstraction (PLAN §6). The game only talks to this interface.

export type AdType = 'midgame' | 'rewarded';
export type AdOutcome = 'finished' | 'error' | 'unavailable';

export interface Platform {
  readonly name: 'crazygames' | 'stub';
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  requestAd(type: AdType, hooks?: { onStart?: () => void }): Promise<AdOutcome>;
  hasAdblock(): Promise<boolean>;
  data: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  };
}

/** Wraps gameplayStart/Stop so repeated calls are idempotent. */
export function trackGameplay(p: Platform) {
  let playing = false;
  return {
    start() {
      if (!playing) {
        playing = true;
        p.gameplayStart();
      }
    },
    stop() {
      if (playing) {
        playing = false;
        p.gameplayStop();
      }
    },
  };
}
