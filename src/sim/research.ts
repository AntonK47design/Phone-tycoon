// Research rules (GDD §11) and everything derived from completed research.

import type { TechCategory } from '../data/components';
import { CHANNEL_CUT, FOUNDER_RP_PER_DAY, OFFICE_REACH } from '../data/components';
import { DISPLAY_SIZES, FINISHES, MATERIALS, SHAPES } from '../data/design';
import { GARAGE_REACH } from '../data/market';
import { FEATURES, FIRST_GEN, PARTS, type PartDef } from '../data/parts';
import { RESEARCH, researchById, type ResearchNode } from '../data/research';
import type { SimEvent } from './events';
import type { GameState } from './state';
import { yearOf } from './time';

export type ResearchStatus = 'done' | 'active' | 'available' | 'tooEarly' | 'locked';

export function isDone(state: GameState, id: string): boolean {
  return state.research.done.includes(id);
}

function unlocks<K extends keyof ResearchNode['unlock']>(state: GameState, key: K): NonNullable<ResearchNode['unlock'][K]>[] {
  const out: NonNullable<ResearchNode['unlock'][K]>[] = [];
  for (const id of state.research.done) {
    const v = researchById(id)?.unlock[key];
    if (v !== undefined) out.push(v as NonNullable<ResearchNode['unlock'][K]>);
  }
  return out;
}

/** Garage (Phase 1) sticks to the current year's standard parts. */
export function editorUnlocked(state: GameState): boolean {
  return state.phase >= 2;
}

export function availableParts(state: GameState, category: TechCategory): PartDef[] {
  const gens = new Set([FIRST_GEN, ...unlocks(state, 'partGen').filter((g) => g.category === category).map((g) => g.gen)]);
  return PARTS.filter((p) => p.category === category && gens.has(p.gen));
}

export function availableMaterials(state: GameState): string[] {
  return MATERIALS.filter((m) => m.id === 'plastic' || unlocks(state, 'material').includes(m.id)).map((m) => m.id);
}

export function availableFinishes(state: GameState): string[] {
  return FINISHES.filter((f) => f.id === 'gloss' || unlocks(state, 'finish').includes(f.id)).map((f) => f.id);
}

export function availableFeatures(state: GameState): string[] {
  const got = unlocks(state, 'feature');
  return FEATURES.filter((f) => f.starter || got.includes(f.id)).map((f) => f.id);
}

export function availableShapes(state: GameState): string[] {
  const got = unlocks(state, 'shape');
  return SHAPES.filter((s) => s.starter || got.includes(s.id)).map((s) => s.id);
}

export function availableSizes(state: GameState): number[] {
  return [...DISPLAY_SIZES, ...unlocks(state, 'sizes').flat()].sort((a, b) => a - b);
}

export function availableOs(state: GameState): string[] {
  return ['leafline', ...unlocks(state, 'os')];
}

export function reach(state: GameState): number {
  if (state.phase < 2) return GARAGE_REACH;
  return Math.max(OFFICE_REACH, ...unlocks(state, 'reach'));
}

/** Share of revenue the sales channels keep (retailers and carriers want their cut). */
export function channelCut(state: GameState): number {
  if (isDone(state, 'carrier')) return CHANNEL_CUT.carrier;
  if (isDone(state, 'retail')) return CHANNEL_CUT.retail;
  return CHANNEL_CUT.online;
}

export function canMarket(state: GameState): boolean {
  return unlocks(state, 'marketing').length > 0;
}

export function presentationLevel(state: GameState): number {
  return Math.max(0, ...unlocks(state, 'presentation'));
}

/** Pioneer surcharge for researching before the release year (GDD §11). */
export function pioneerFactor(node: ResearchNode, year: number): number {
  return 1 + 1.5 * Math.max(0, node.year - year);
}

export function researchCost(node: ResearchNode, year: number): { rp: number; money: number } {
  const f = pioneerFactor(node, year);
  return { rp: Math.round(node.rp * f), money: Math.round(node.money * f) };
}

export function researchStatus(state: GameState, node: ResearchNode): ResearchStatus {
  if (isDone(state, node.id)) return 'done';
  if (state.research.current?.id === node.id) return 'active';
  if (node.requires.some((r) => !isDone(state, r))) return 'locked';
  if (yearOf(state.day) < node.year - 1) return 'tooEarly';
  return 'available';
}

export function rpPerDay(state: GameState): number {
  return state.phase >= 2 ? FOUNDER_RP_PER_DAY : 0;
}

export function startResearch(state: GameState, id: string): SimEvent[] {
  const node = researchById(id);
  if (!node || state.phase < 2) return [{ type: 'rejected', reason: 'notReady' }];
  if (state.research.current) return [{ type: 'rejected', reason: 'busy' }];
  if (researchStatus(state, node) !== 'available') return [{ type: 'rejected', reason: 'notReady' }];
  const cost = researchCost(node, yearOf(state.day));
  if (state.company.cash < cost.money) return [{ type: 'rejected', reason: 'noCash' }];
  state.company.cash -= cost.money;
  state.research.current = { id, progress: 0 };
  return [{ type: 'researchStarted', id }];
}

/** Daily research progress. `extraDays` lets offline credit add progress. */
export function tickResearch(state: GameState, days = 1): SimEvent[] {
  const cur = state.research.current;
  if (!cur) return [];
  const node = researchById(cur.id)!;
  const need = researchCost(node, yearOf(state.day)).rp;
  cur.progress += rpPerDay(state) * days;
  if (cur.progress < need) return [];
  state.research.done.push(cur.id);
  state.research.current = null;
  return [{ type: 'researchDone', id: cur.id }];
}

export function researchProgress(state: GameState): { node: ResearchNode; progress: number; need: number; daysLeft: number } | null {
  const cur = state.research.current;
  if (!cur) return null;
  const node = researchById(cur.id)!;
  const need = researchCost(node, yearOf(state.day)).rp;
  const rate = Math.max(0.01, rpPerDay(state));
  return { node, progress: cur.progress, need, daysLeft: Math.ceil((need - cur.progress) / rate) };
}

/** Cheapest next node that would unlock something new (used for "N research until X" teasers). */
export function nextResearchTeaser(state: GameState): ResearchNode | null {
  const year = yearOf(state.day);
  const options = RESEARCH.filter((n) => researchStatus(state, n) === 'available');
  options.sort((a, b) => researchCost(a, year).rp - researchCost(b, year).rp);
  return options[0] ?? null;
}
