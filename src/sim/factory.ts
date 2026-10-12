// Own factory (GDD §9): lines build phones into stock, scrap costs money and reviews.

import { inflation } from '../data/eras';
import {
  DEFAULT_TARGET_WEEKS,
  FACTORY_SIZES,
  FACTORY_UPKEEP_RATE,
  lineCapacityDay,
  lineScrap,
  lineUpgradePrice,
  MAX_LINE_LEVEL,
  NEW_LINE_PRICE,
  OVERFLOW_RATE,
  TEMPOS,
  warehouseCapacity,
  warehouseUpgradePrice,
  type Tempo,
} from '../data/factory';
import { DAYS_PER_WEEK } from '../data/eras';
import { unitCost } from './economy/market';
import type { SimEvent } from './events';
import { clamp } from './scoring/score';
import type { FactoryLine, FactoryState, GameState, Product } from './state';
import { productionBoost } from './team';
import { yearOf } from './time';

export function newFactory(): FactoryState {
  return { size: 0, lines: [], nextLineId: 1, tempo: 'normal', warehouse: 0, targetWeeks: DEFAULT_TARGET_WEEKS, invested: 0, produced: 0, scrapped: 0 };
}

const inf = (state: GameState) => inflation(Math.floor(yearOf(state.day)));

export function maxLines(state: GameState): number {
  return state.factory.size > 0 ? FACTORY_SIZES[state.factory.size - 1].lines : 0;
}

export function buildFactoryCost(state: GameState): number {
  return FACTORY_SIZES[0].price * inf(state);
}

/** Next factory size, or null when at the biggest. */
export function factorySizeCost(state: GameState): number | null {
  const next = FACTORY_SIZES[state.factory.size];
  return state.factory.size > 0 && next ? next.price * inf(state) : null;
}

export function newLineCost(state: GameState): number | null {
  if (state.factory.size < 1 || state.factory.lines.length >= maxLines(state)) return null;
  return NEW_LINE_PRICE * inf(state) * (1 + 0.25 * state.factory.lines.length);
}

export function lineUpgradeCost(state: GameState, line: FactoryLine): number | null {
  return line.level >= MAX_LINE_LEVEL ? null : lineUpgradePrice(line.level) * inf(state);
}

export function warehouseCost(state: GameState): number {
  return warehouseUpgradePrice(state.factory.warehouse) * inf(state);
}

export function stockTotal(state: GameState): number {
  return state.products.reduce((a, p) => a + (p.active && !p.madeToOrder ? p.stock : 0), 0);
}

/** Units per day a line builds right now (tempo and production leads included). */
export function lineRate(state: GameState, line: FactoryLine): number {
  return lineCapacityDay(line.level) * TEMPOS[state.factory.tempo].speed * productionBoost(state).speed;
}

/** Scrap share of a line right now. */
export function lineScrapRate(state: GameState, line: FactoryLine): number {
  return lineScrap(line.level) * TEMPOS[state.factory.tempo].scrap * productionBoost(state).scrap;
}

/** Review points lost to returns from scrap that slipped through. */
export function returnsPenalty(p: Product): number {
  return (p.defectRate ?? 0) * 5;
}

function lineProduct(state: GameState, line: FactoryLine): Product | null {
  const p = line.productId === null ? null : state.products.find((x) => x.id === line.productId);
  return p && p.active && !p.madeToOrder ? p : null;
}

/**
 * A new phone gets a line: an idle one, else the line building the weakest seller
 * (old phones keep selling from stock). Returns the line id, or null.
 */
export function autoAssign(state: GameState, productId: number): number | null {
  const lines = state.factory.lines;
  if (!lines.length) return null;
  const weakest = (l: FactoryLine) => lineProduct(state, l)?.lastWeekDemand ?? -1;
  const line = lines.find((l) => !lineProduct(state, l)) ?? [...lines].sort((a, b) => weakest(a) - weakest(b))[0];
  line.productId = productId;
  line.paused = false;
  line.carry = 0;
  return line.id;
}

export type FactoryAction =
  | { type: 'buildFactory' }
  | { type: 'growFactory' }
  | { type: 'addLine' }
  | { type: 'upgradeLine'; id: number }
  | { type: 'assignLine'; id: number; productId: number | null }
  | { type: 'pauseLine'; id: number; paused: boolean }
  | { type: 'setTempo'; tempo: Tempo }
  | { type: 'upgradeWarehouse' }
  | { type: 'setTargetWeeks'; weeks: number };

function spend(state: GameState, amount: number): boolean {
  if (state.company.cash < amount) return false;
  state.company.cash -= amount;
  state.factory.invested += amount;
  return true;
}

function addLine(state: GameState): FactoryLine {
  const line: FactoryLine = { id: state.factory.nextLineId++, level: 1, productId: null, paused: false, carry: 0, lastWeek: 0, week: 0 };
  state.factory.lines.push(line);
  // Start right away with the newest phone that has no line yet.
  const busy = new Set(state.factory.lines.map((l) => l.productId));
  const p = [...state.products].reverse().find((x) => x.active && !x.madeToOrder && !busy.has(x.id));
  if (p) line.productId = p.id;
  return line;
}

export function applyFactoryAction(state: GameState, action: FactoryAction): SimEvent[] {
  const f = state.factory;
  const no = (reason: 'noCash' | 'notReady' | 'busy' = 'notReady'): SimEvent[] => [{ type: 'rejected', reason }];
  switch (action.type) {
    case 'buildFactory': {
      if (f.size > 0 || !state.phase3Ready || state.phase < 2) return no();
      if (!spend(state, buildFactoryCost(state))) return no('noCash');
      f.size = 1;
      state.phase = 3;
      addLine(state);
      return [{ type: 'factoryBuilt' }];
    }
    case 'growFactory': {
      const cost = factorySizeCost(state);
      if (cost === null) return no();
      if (!spend(state, cost)) return no('noCash');
      f.size += 1;
      return [{ type: 'factoryGrown', size: f.size }];
    }
    case 'addLine': {
      const cost = newLineCost(state);
      if (cost === null) return no();
      if (!spend(state, cost)) return no('noCash');
      const line = addLine(state);
      return [{ type: 'lineAdded', id: line.id }];
    }
    case 'upgradeLine': {
      const line = f.lines.find((l) => l.id === action.id);
      const cost = line ? lineUpgradeCost(state, line) : null;
      if (!line || cost === null) return no();
      if (!spend(state, cost)) return no('noCash');
      line.level += 1;
      return [{ type: 'lineUpgraded', id: line.id, level: line.level }];
    }
    case 'assignLine': {
      const line = f.lines.find((l) => l.id === action.id);
      if (!line) return no();
      const p = action.productId === null ? null : state.products.find((x) => x.id === action.productId);
      if (action.productId !== null && (!p || !p.active || p.madeToOrder)) return no();
      line.productId = action.productId;
      line.carry = 0;
      return [];
    }
    case 'pauseLine': {
      const line = f.lines.find((l) => l.id === action.id);
      if (line) line.paused = action.paused;
      return [];
    }
    case 'setTempo':
      f.tempo = action.tempo;
      return [];
    case 'upgradeWarehouse': {
      if (f.size < 1) return no();
      if (!spend(state, warehouseCost(state))) return no('noCash');
      f.warehouse += 1;
      return [{ type: 'warehouseUpgraded', level: f.warehouse }];
    }
    case 'setTargetWeeks':
      f.targetWeeks = clamp(Math.round(action.weeks), 1, 12);
      return [];
  }
}

/**
 * One day of production. `dailyDemand` holds each product's expected units per day.
 * Lines fill stock up to `targetWeeks` of demand (plus waiting customers) and stop there.
 */
export function produceDay(state: GameState, dailyDemand: Map<number, number>): SimEvent[] {
  const f = state.factory;
  if (f.size < 1) return [];
  const year = yearOf(state.day);
  let built = 0;
  let scrapped = 0;
  for (const line of f.lines) {
    const p = lineProduct(state, line);
    if (!p || line.paused) continue;
    const incoming = p.orders.reduce((a, o) => a + o.units, 0);
    // Other lines on the same product already counted? Share the target between them.
    const sharing = f.lines.filter((l) => !l.paused && l.productId === p.id).length;
    const target = ((dailyDemand.get(p.id) ?? 0) * DAYS_PER_WEEK * f.targetWeeks + p.backlog) / sharing;
    const need = Math.max(0, target - (p.stock + incoming) / sharing);
    if (need < 1) continue;
    const cost = unitCost(p.design, year, 'factory', line.level);
    const want = Math.min(lineRate(state, line) + line.carry, need);
    let units = Math.floor(want);
    line.carry = want - units;
    units = Math.min(units, Math.floor(Math.max(0, state.company.cash) / cost));
    if (units <= 0) continue;
    const rate = lineScrapRate(state, line);
    const bad = Math.round(units * rate);
    const good = units - bad;
    state.company.cash -= units * cost;
    // Unit cost of the stock: weighted average, scrap included.
    if (good > 0) {
      const perGood = (units * cost) / good;
      p.unitCost = (p.unitCost * p.stock + perGood * good) / (p.stock + good);
      p.stock += good;
    }
    p.defectRate = (p.defectRate ?? rate) * 0.9 + rate * 0.1;
    line.week += good;
    built += good;
    scrapped += bad;
  }
  f.produced += built;
  f.scrapped += scrapped;
  return built > 0 ? [{ type: 'produced', units: built, scrapped }] : [];
}

/** Weekly factory costs: upkeep and warehouse overflow. Returns the amount. */
export function factoryWeek(state: GameState): number {
  const f = state.factory;
  if (f.size < 1) return 0;
  for (const l of f.lines) {
    l.lastWeek = l.week;
    l.week = 0;
  }
  const upkeep = f.invested * FACTORY_UPKEEP_RATE;
  const cap = warehouseCapacity(f.warehouse);
  const total = stockTotal(state);
  let overflow = 0;
  if (total > cap) {
    const share = (total - cap) / total;
    for (const p of state.products) if (p.active && !p.madeToOrder) overflow += p.stock * share * p.unitCost * OVERFLOW_RATE;
  }
  return upkeep + overflow;
}
