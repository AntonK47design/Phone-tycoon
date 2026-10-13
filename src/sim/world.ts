// Expansion (GDD §14, Phase 4): regions, own stores and contract jobs.

import { DAYS_PER_WEEK, inflation } from '../data/eras';
import { ALL_SEGMENTS, type Segment } from '../data/market';
import {
  CLIENTS,
  FOREIGN_REACH,
  MAX_STORES,
  REGIONS,
  STORE_BRAND,
  STORE_PRICE,
  STORE_REACH,
  STORE_RENT,
  regionById,
  type RegionDef,
} from '../data/regions';
import type { SimEvent } from './events';
import { createRng } from './rng';
import { clamp, overallRating, priceAnchor } from './scoring/score';
import type { Contract, GameState, Product } from './state';
import { yearOf } from './time';

export function newRegions(): GameState['regions'] {
  return { entered: ['home'], stores: {} };
}

export function newContracts(): GameState['contracts'] {
  return { offers: [], nextId: 1, nextOfferDay: 0, done: 0 };
}

const inf = (state: GameState) => inflation(Math.floor(yearOf(state.day)));

export function entryCost(state: GameState, region: RegionDef): number {
  return region.entry * inf(state);
}

export function storeCost(state: GameState, region: string): number {
  return STORE_PRICE * inf(state) * (1 + 0.5 * (state.regions.stores[region] ?? 0));
}

/** Reach multiplier in a region (relative to the company's base reach). */
export function regionReach(state: GameState, region: string, tariffed = false): number {
  if (!state.regions.entered.includes(region)) return 0;
  const stores = state.regions.stores[region] ?? 0;
  const base = region === 'home' ? 1 : FOREIGN_REACH;
  return base * (1 + STORE_REACH * stores) * (tariffed ? 0.85 : 1);
}

/** How well a phone fits a region's taste: 0.7 … 1.3 (GDD §14.1). */
export function regionFit(product: Product, region: RegionDef): number {
  const r = overallRating(product.design, product.design.kitYear);
  const t = r.tech.categories;
  const ratings: Record<string, number> = {
    design: r.design.score,
    camera: t.camera,
    battery: t.battery,
    performance: (t.chip + t.ram) / 2,
    waterproof: product.design.features.includes('waterproof') ? 9 : 4,
  };
  let fit = region.segments[product.design.segment] ?? 1;
  for (const [k, w] of Object.entries(region.prefs)) fit *= 1 + (w ?? 0) * ((ratings[k] - 6.5) / 1.5);
  return clamp(fit, 0.7, 1.3);
}

/** Cached per product (taste doesn't change once a phone is on sale). */
export function productFit(product: Product, region: string): number {
  product.fit ??= {};
  product.fit[region] ??= Math.round(regionFit(product, regionById(region)) * 1000) / 1000;
  return product.fit[region];
}

export function storeRent(state: GameState): number {
  const n = Object.values(state.regions.stores).reduce((a, b) => a + b, 0);
  return n * STORE_RENT * inf(state);
}

export type WorldAction =
  | { type: 'enterRegion'; region: string }
  | { type: 'openStore'; region: string }
  | { type: 'fulfilContract'; id: number; productId: number }
  | { type: 'declineContract'; id: number };

/** Delivery value of a contract today (late: −10 % per week, score bonus +5 % per point). */
export function contractValue(state: GameState, c: Contract, review: number): number {
  const lateWeeks = Math.max(0, Math.ceil((state.day - c.deadline) / DAYS_PER_WEEK));
  const bonus = 1 + 0.05 * Math.max(0, Math.floor(review - c.minReview));
  return c.payout * Math.max(0, 1 - 0.1 * lateWeeks) * bonus;
}

/** Why a product can't fill a contract (null = it can). */
export function contractProblem(_state: GameState, c: Contract, p: Product, review: number): 'segment' | 'review' | 'cost' | 'stock' | null {
  if (p.design.segment !== c.segment) return 'segment';
  if (review < c.minReview) return 'review';
  if (p.unitCost > c.maxCost) return 'cost';
  if (p.stock < c.units) return 'stock';
  return null;
}

export function applyWorldAction(state: GameState, action: WorldAction, currentReview: (p: Product) => number): SimEvent[] {
  const no = (reason: 'noCash' | 'notReady' = 'notReady'): SimEvent[] => [{ type: 'rejected', reason }];
  switch (action.type) {
    case 'enterRegion': {
      const region = REGIONS.find((r) => r.id === action.region);
      if (!region || !state.phase4Ready || state.regions.entered.includes(region.id)) return no();
      const cost = entryCost(state, region);
      if (state.company.cash < cost) return no('noCash');
      state.company.cash -= cost;
      state.regions.entered.push(region.id);
      if (state.phase < 4) state.phase = 4;
      return [{ type: 'regionEntered', region: region.id }];
    }
    case 'openStore': {
      const n = state.regions.stores[action.region] ?? 0;
      if (!state.regions.entered.includes(action.region) || state.phase < 4 || n >= MAX_STORES) return no();
      const cost = storeCost(state, action.region);
      if (state.company.cash < cost) return no('noCash');
      state.company.cash -= cost;
      state.regions.stores[action.region] = n + 1;
      state.company.brand = clamp(state.company.brand + STORE_BRAND, 0, 100);
      state.company.fans += 500 * inf(state);
      return [{ type: 'storeOpened', region: action.region }];
    }
    case 'fulfilContract': {
      const c = state.contracts.offers.find((x) => x.id === action.id);
      const p = state.products.find((x) => x.id === action.productId && x.active);
      if (!c || !p) return no();
      const review = currentReview(p);
      if (contractProblem(state, c, p, review)) return no();
      const value = contractValue(state, c, review);
      p.stock -= c.units;
      state.company.cash += value;
      state.stats.revenueTotal += value;
      state.week.revenue += value;
      state.week.profit += value - c.units * p.unitCost;
      state.contracts.offers = state.contracts.offers.filter((x) => x !== c);
      state.contracts.done += 1;
      return [{ type: 'contractDone', id: c.id, payout: value }];
    }
    case 'declineContract':
      state.contracts.offers = state.contracts.offers.filter((x) => x.id !== action.id);
      return [];
  }
}

/** Rounds to 2 significant digits. */
function nice(n: number): number {
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1));
  return Math.round(n / mag) * mag;
}

/** Weekly: new contract offers (max 3) and overdue ones expire. */
export function tickContracts(state: GameState): SimEvent[] {
  if (state.phase < 4) return [];
  const events: SimEvent[] = [];
  const c = state.contracts;
  for (const o of [...c.offers]) {
    if (state.day > o.deadline + 4 * DAYS_PER_WEEK) {
      c.offers = c.offers.filter((x) => x !== o);
      events.push({ type: 'contractFailed', id: o.id });
    }
  }
  if (c.offers.length >= 3 || state.day < c.nextOfferDay) return events;
  const rng = createRng(state.rng);
  const year = yearOf(state.day);
  const segs: Segment[] = ALL_SEGMENTS.filter((s) => state.products.some((p) => p.active && p.design.segment === s));
  const segment = segs.length ? rng.pick(segs) : rng.pick(ALL_SEGMENTS.slice(0, 3));
  const mine = state.products.filter((p) => p.active && p.design.segment === segment);
  const weekly = mine.reduce((a, p) => a + p.lastWeekDemand, 0);
  // Review and cost are both taken from the same phone (the best one today), so one model can meet both.
  const nowScore = (p: Product) => p.review.score - (p.review.p - overallRating(p.design, year).p);
  const best = mine.length ? mine.reduce((a, p) => (nowScore(p) > nowScore(a) ? p : a)) : null;
  const typicalCost = best ? best.unitCost : priceAnchor({ segment }, year) * 0.45;
  const currentBest = best ? nowScore(best) : 6.5;
  // One phone delivers the order, so it is sized on that phone's demand (with a floor from the segment).
  const units = nice(clamp(Math.max(best?.lastWeekDemand ?? 0, weekly * 0.3, 500) * rng.range(2, 5), 1000, 200_000));
  const maxCost = Math.round(typicalCost * rng.range(1.05, 1.25));
  const offer: Contract = {
    id: c.nextId++,
    client: rng.pick(CLIENTS),
    segment,
    // Asks for roughly what the company builds today (not its all-time best).
    minReview: clamp(Math.round((currentBest - rng.range(0.3, 1.2)) * 2) / 2, 5, 8.5),
    maxCost,
    units,
    deadline: state.day + Math.round(rng.range(6, 12)) * DAYS_PER_WEEK,
    payout: Math.round(units * maxCost * rng.range(1.3, 1.8)),
    accepted: false,
  };
  c.offers.push(offer);
  c.nextOfferDay = state.day + Math.round(rng.range(3, 6)) * DAYS_PER_WEEK;
  state.rng = rng.state;
  events.push({ type: 'contractOffered', id: offer.id });
  return events;
}
