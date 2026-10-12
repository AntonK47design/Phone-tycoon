// Save/load through the platform data module (cloud on CrazyGames, localStorage otherwise).

import type { Platform } from '../platform/platform';
import { deserialize, serialize } from '../sim/save/save';
import type { GameState } from '../sim/state';

export const SAVE_KEY = 'phone-empire-save';
const AUTOSAVE_MS = 30_000;

export function loadSave(platform: Platform): { state: GameState; savedAt: number } | null {
  const raw = platform.data.get(SAVE_KEY);
  if (!raw) return null;
  try {
    const file = deserialize(raw);
    return { state: file.state, savedAt: file.savedAt };
  } catch (e) {
    console.warn('Save could not be loaded, starting fresh.', e);
    return null;
  }
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
