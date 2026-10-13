// Save/load through the platform data module (cloud on CrazyGames, localStorage otherwise).

import type { Platform } from '../platform/platform';
import { deserialize, serialize } from '../sim/save/save';
import type { GameState } from '../sim/state';

export const SAVE_KEY = 'phone-empire-save';
const AUTOSAVE_MS = 30_000;

/** Loads the newest readable copy (cloud vs. local); broken copies are skipped. */
export function loadSave(platform: Platform): { state: GameState; savedAt: number } | null {
  return pickNewest(platform.data.candidates(SAVE_KEY));
}

export function pickNewest(raws: string[]): { state: GameState; savedAt: number } | null {
  let best: { state: GameState; savedAt: number } | null = null;
  for (const raw of raws) {
    try {
      const file = deserialize(raw);
      if (!best || file.savedAt > best.savedAt) best = { state: file.state, savedAt: file.savedAt };
    } catch (e) {
      console.warn('A save copy could not be loaded, skipping it.', e);
    }
  }
  return best;
}

export function writeSave(platform: Platform, state: GameState) {
  platform.data.set(SAVE_KEY, serialize(state, Date.now()));
}

export function installAutosave(save: () => void) {
  setInterval(save, AUTOSAVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);
}
