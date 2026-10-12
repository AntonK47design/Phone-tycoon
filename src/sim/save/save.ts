// Save serialization with versioning and migrations (PLAN §3).

import { defaultParts, LAST_GEN } from '../../data/parts';
import { SAVE_VERSION, type GameState } from '../state';

export interface SaveFile {
  version: number;
  /** Real time in ms when saved (used for offline progress from M2 on). */
  savedAt: number;
  state: GameState;
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** v1 designs used a "garage kit" instead of explicit parts. */
function upgradeDesign(d: Obj | null | undefined) {
  if (!d) return;
  const gen = Math.min(LAST_GEN, Math.max(2007, d.kitYear ?? 2007));
  d.parts ??= defaultParts('std', gen);
  d.features ??= ['wifi'];
  d.customPrice ??= null;
}

/** MIGRATIONS[n] upgrades a save from version n to n + 1. */
export const MIGRATIONS: Record<number, Migration> = {
  1: (s: Obj) => {
    upgradeDesign(s.draft);
    upgradeDesign(s.dev?.design);
    for (const p of s.products ?? []) {
      upgradeDesign(p.design);
      p.madeToOrder ??= true;
      p.stock ??= 0;
      p.backlog ??= 0;
      p.orders ??= [];
      p.hype ??= 0;
      p.weekDemand ??= 0;
      p.lastWeekDemand ??= p.lastWeekUnits ?? 0;
      p.launchHype ??= 0;
    }
    s.company.debt ??= 0;
    delete s.company.loanUsed;
    s.phase3Ready ??= false;
    s.research ??= { done: [], current: null };
    s.stats.bestLaunchHype ??= 0;
    s.history ??= { cash: (s.cashHistory ?? []).slice(-52), revenue: [], profit: [], playerUnits: [], compUnits: {} };
    delete s.cashHistory;
    s.week ??= { revenue: 0, profit: 0, units: 0 };
    return s;
  },
  2: (s: Obj) => {
    s.research.budget ??= 0;
    return s;
  },
  3: (s: Obj) => {
    // M3: team, buildings, daily orders. An existing office becomes office level 1.
    s.team ??= { staff: [], applicants: [], nextId: 1, poolDay: -999, office: s.phase >= 2 ? 1 : 0, lab: 0, studio: 0, boost: 0, lastBonusDay: -999 };
    s.daily ??= { date: null, orders: [], calendarStep: 0, cycles: 0, lastClaim: null };
    s.cosmetics ??= [];
    s.stats.hires ??= 0;
    s.stats.trainings ??= 0;
    s.stats.reorders ??= 0;
    return s;
  },
};

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
