// Save serialization with versioning and migrations (PLAN §3).

import { SAVE_VERSION, type GameState } from '../state';

export interface SaveFile {
  version: number;
  /** Real time in ms when saved (used for offline progress from M2 on). */
  savedAt: number;
  state: GameState;
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * MIGRATIONS[n] upgrades a save from version n to n + 1.
 * Version 1 is the first public schema, so the list is still empty.
 */
export const MIGRATIONS: Record<number, Migration> = {};

export function serialize(state: GameState, now: number): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt: now, state };
  return JSON.stringify(file);
}

export class SaveError extends Error {}

export function deserialize(json: string, migrations: Record<number, Migration> = MIGRATIONS, target = SAVE_VERSION): SaveFile {
  let raw: { version?: unknown; savedAt?: unknown; state?: unknown };
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SaveError('corrupt');
  }
  if (typeof raw.version !== 'number' || typeof raw.state !== 'object' || raw.state === null) {
    throw new SaveError('invalid');
  }
  if (raw.version > target) throw new SaveError('newer');
  let version = raw.version;
  let state = raw.state as Record<string, unknown>;
  while (version < target) {
    const m = migrations[version];
    if (!m) throw new SaveError(`missing migration ${version}`);
    state = m(state);
    version++;
  }
  state.version = target;
  return { version: target, savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0, state: state as unknown as GameState };
}
