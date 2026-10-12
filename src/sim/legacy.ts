// Endgame (GDD §16): records for the Hall of Fame, achievements, prestige with legacy
// bonuses, and scenarios unlocked by achievements.

import { colorById } from '../data/design';
import type { SimEvent } from './events';
import { ecosystemComplete } from './giant';
import type { GameState, HallEntry, Legacy } from './state';
import { yearOf } from './time';

export function newLegacy(): Legacy {
  return { points: 0, bonuses: {}, runs: 0, peakValuation: 0, hall: [], achievements: [], scenario: null };
}

export interface AchievementDef {
  id: string;
  check: (s: GameState) => boolean;
}

const stores = (s: GameState) => Object.values(s.regions.stores).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstPhone', check: (s) => s.stats.launches >= 1 },
  { id: 'garageHero', check: (s) => s.phase === 1 && s.company.cash >= 20_000 },
  { id: 'perfect9', check: (s) => s.stats.bestReview >= 9 },
  { id: 'million', check: (s) => s.stats.unitsTotal >= 1_000_000 },
  { id: 'tenMillion', check: (s) => s.stats.unitsTotal >= 10_000_000 },
  { id: 'fullOffice', check: (s) => s.team.office >= 4 },
  { id: 'megaFactory', check: (s) => s.factory.size >= 3 },
  { id: 'globe', check: (s) => s.regions.entered.length >= 5 },
  { id: 'storeChain', check: (s) => stores(s) >= 10 },
  { id: 'contractor', check: (s) => s.contracts.done >= 10 },
  { id: 'ownChip', check: (s) => s.giant.chip.level >= 1 },
  { id: 'ownOs', check: (s) => s.giant.os.level >= 1 },
  { id: 'ecosystem', check: (s) => ecosystemComplete(s) },
  { id: 'takeover', check: (s) => s.giant.acquired.length >= 1 },
  { id: 'billion', check: (s) => s.peakValuation >= 1e9 },
  { id: 'tenBillion', check: (s) => s.peakValuation >= 1e10 },
  { id: 'hundredBillion', check: (s) => s.peakValuation >= 1e11 },
  { id: 'frontier5', check: (s) => (s.research.frontier ?? 0) >= 5 },
  { id: 'year2050', check: (s) => yearOf(s.day) >= 2050 },
  { id: 'endgame', check: (s) => s.phase6Ready },
  { id: 'prestige', check: (s) => s.legacy.runs >= 1 },
];

/** Scenarios and the achievement that unlocks each (GDD §16). */
export const SCENARIOS: { id: string; unlock: string }[] = [
  { id: 'budgetOnly', unlock: 'million' },
  { id: 'noMarketing', unlock: 'perfect9' },
  { id: 'recession', unlock: 'globe' },
  { id: 'lateStart', unlock: 'billion' },
];

export function scenarioUnlocked(legacy: Legacy, id: string): boolean {
  const s = SCENARIOS.find((x) => x.id === id);
  return !!s && legacy.achievements.includes(s.unlock);
}

/** Legacy shop (GDD §16). Level n costs 2·(n+1) points. */
export const LEGACY_BONUSES: { id: string; max: number }[] = [
  { id: 'cash', max: 8 },
  { id: 'research', max: 10 },
  { id: 'brand', max: 6 },
  { id: 'skill', max: 4 },
  { id: 'colors', max: 1 },
];

export function bonusCost(level: number): number {
  return 2 * (level + 1);
}

export function bonus(state: GameState, id: string): number {
  return state.legacy.bonuses[id] ?? 0;
}

/** Legacy points a prestige now would earn: floor(√(peak valuation / 10 M$)). */
export function legacyPointsFor(state: GameState): number {
  return Math.floor(Math.sqrt(Math.max(0, state.peakValuation) / 10_000_000));
}

function record(state: GameState, entry: HallEntry): boolean {
  const i = state.hall.findIndex((h) => h.kind === entry.kind);
  if (i >= 0 && state.hall[i].value >= entry.value) return false;
  if (i >= 0) state.hall[i] = entry;
  else state.hall.push(entry);
  return true;
}

/** Updates records and achievements. Cheap enough to run weekly and after launches. */
export function checkLegacy(state: GameState, valuation: number): SimEvent[] {
  const events: SimEvent[] = [];
  const year = Math.floor(yearOf(state.day));
  state.peakValuation = Math.max(state.peakValuation, valuation);
  const best = state.products.reduce<(typeof state.products)[number] | null>((a, p) => (!a || p.review.score > a.review.score ? p : a), null);
  if (best && record(state, { kind: 'bestReview', name: best.design.name, value: best.review.score, year: Math.floor(best.design.kitYear), color: colorById(best.design.colorId)?.hex }))
    events.push({ type: 'record', kind: 'bestReview' });
  const seller = state.products.reduce<(typeof state.products)[number] | null>((a, p) => (!a || p.unitsSold > a.unitsSold ? p : a), null);
  if (seller && seller.unitsSold > 0) record(state, { kind: 'bestSeller', name: seller.design.name, value: seller.unitsSold, year: Math.floor(seller.design.kitYear), color: colorById(seller.design.colorId)?.hex });
  const hype = state.products.reduce<(typeof state.products)[number] | null>((a, p) => (!a || p.launchHype > a.launchHype ? p : a), null);
  if (hype && hype.launchHype > 0) record(state, { kind: 'biggestLaunch', name: hype.design.name, value: Math.round(hype.launchHype), year: Math.floor(hype.design.kitYear), color: colorById(hype.design.colorId)?.hex });
  record(state, { kind: 'peakValuation', name: state.company.name, value: Math.round(state.peakValuation), year });
  record(state, { kind: 'mostFans', name: state.company.name, value: Math.round(state.company.fans), year });
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id) || !a.check(state)) continue;
    state.achievements.push(a.id);
    if (!state.legacy.achievements.includes(a.id)) state.legacy.achievements.push(a.id);
    events.push({ type: 'achievement', id: a.id });
  }
  return events;
}

/**
 * Legacy for the next company: earned points, records merged into the hall (best per kind),
 * achievements kept. The caller starts the new game with it.
 */
export function legacyAfterPrestige(state: GameState, purchases: Record<string, number>, scenario: string | null): Legacy {
  const prev = state.legacy;
  let points = prev.points + legacyPointsFor(state);
  const bonuses = { ...prev.bonuses };
  for (const def of LEGACY_BONUSES) {
    let want = purchases[def.id] ?? 0;
    while (want-- > 0 && (bonuses[def.id] ?? 0) < def.max && points >= bonusCost(bonuses[def.id] ?? 0)) {
      points -= bonusCost(bonuses[def.id] ?? 0);
      bonuses[def.id] = (bonuses[def.id] ?? 0) + 1;
    }
  }
  const hall = [...prev.hall];
  for (const h of state.hall) {
    const i = hall.findIndex((x) => x.kind === h.kind);
    if (i < 0) hall.push(h);
    else if (h.value > hall[i].value) hall[i] = h;
  }
  const achievements = [...new Set([...prev.achievements, ...state.achievements, 'prestige'])];
  const next: Legacy = { points, bonuses, runs: prev.runs + 1, peakValuation: Math.max(prev.peakValuation, state.peakValuation), hall, achievements, scenario: null };
  next.scenario = scenario && scenarioUnlocked(next, scenario) ? scenario : null;
  return next;
}
