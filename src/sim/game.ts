// Game rules: new game, player actions and the daily tick.

import { COLORS } from '../data/design';
import { GARAGE_CAPACITY_WEEK, GARAGE_UPKEEP_WEEK } from '../data/components';
import { DAYS_PER_WEEK, inflation } from '../data/eras';
import { GARAGE_REACH, OUTLETS, type Segment } from '../data/market';
import { COMPANY_PREFIXES, COMPANY_SUFFIXES, PHONE_WORDS } from '../data/names';
import {
  attractiveness,
  currentUnitCost,
  devCost,
  devDays,
  devPoints,
  FOUNDER_POINTS_PER_DAY,
  unitCost,
  weeklyDemand,
} from './economy/market';
import type { SimEvent } from './events';
import { checkGoals } from './goals';
import { createRng, type Rng } from './rng';
import {
  clamp,
  designScore,
  overallRating,
  reviewAspects,
  reviewEstimate,
  suggestedPrice,
  techScore,
  type ReviewAspect,
} from './scoring/score';
import { SAVE_VERSION, type GameState, type PhoneDesign, type Product, type ReviewCard, type ReviewResult } from './state';
import { yearOf } from './time';

export const START_CASH = 2_000;

export function newGame(seed: number): GameState {
  const rng = createRng(seed);
  const company = `${rng.pick(COMPANY_PREFIXES)} ${rng.pick(COMPANY_SUFFIXES)}`;
  const word = rng.pick(PHONE_WORDS);
  const draft: PhoneDesign = {
    name: `${word} 1`,
    segment: 'mid',
    price: 0,
    colorId: null,
    shapeId: 'round',
    displaySize: 3.5,
    materialId: 'plastic',
    finishId: 'gloss',
    osId: 'leafline',
    kitYear: 2007,
  };
  draft.price = suggestedPrice(draft, 2007);
  return {
    version: SAVE_VERSION,
    seed,
    rng: rng.state,
    day: 0,
    clockStarted: false,
    company: { name: company, cash: START_CASH, brand: 0, fans: 0 },
    phase: 1,
    officeReady: false,
    tutorial: 'color',
    draft,
    dev: null,
    products: [],
    nextProductId: 1,
    unlockedColors: COLORS.filter((c) => c.starter).map((c) => c.id),
    completedGoals: [],
    stats: { launches: 0, unitsTotal: 0, revenueTotal: 0, profitTotal: 0, bestReview: 0 },
    cashHistory: [],
  };
}

export type Action =
  | { type: 'setDraft'; patch: Partial<Pick<PhoneDesign, 'colorId' | 'shapeId' | 'displaySize' | 'name'>> }
  | { type: 'setTutorial'; step: GameState['tutorial'] }
  | { type: 'startDev' }
  | { type: 'launch' }
  | { type: 'renameCompany'; name: string }
  | { type: 'debugCash'; amount: number };

export function isFirstLaunch(state: GameState): boolean {
  return state.stats.launches === 0;
}

/** Applies a player action. Mutates `state` and returns emitted events. */
export function applyAction(state: GameState, action: Action): SimEvent[] {
  const year = yearOf(state.day);
  switch (action.type) {
    case 'setDraft': {
      Object.assign(state.draft, action.patch);
      state.draft.kitYear = Math.floor(year);
      state.draft.price = suggestedPrice(state.draft, year);
      return [];
    }
    case 'setTutorial':
      state.tutorial = action.step;
      return [];
    case 'renameCompany': {
      const name = action.name.trim().slice(0, 28);
      if (name) state.company.name = name;
      return [];
    }
    case 'debugCash':
      state.company.cash += action.amount;
      return checkGoals(state);
    case 'startDev':
      return startDev(state);
    case 'launch':
      return launch(state);
  }
}

function startDev(state: GameState): SimEvent[] {
  if (state.dev) return [{ type: 'rejected', reason: 'busy' }];
  const year = yearOf(state.day);
  const design: PhoneDesign = { ...state.draft, kitYear: Math.floor(year) };
  design.price = suggestedPrice(design, year);
  const cost = devCost(design);
  if (isFirstLaunch(state)) {
    // Tutorial: the first prototype is built overnight for free (GDD §19).
    const req = devPoints(design);
    state.dev = { design, required: req, progress: { ...req }, done: true };
    return [{ type: 'devDone' }];
  }
  if (state.company.cash < cost) return [{ type: 'rejected', reason: 'noCash' }];
  state.company.cash -= cost;
  state.dev = {
    design,
    required: devPoints(design),
    progress: { design: 0, tech: 0, software: 0 },
    done: false,
  };
  return [{ type: 'devStarted', days: devDays(design), cost }];
}

function makeCards(rng: Rng, est: ReturnType<typeof reviewEstimate>): ReviewCard[] {
  const aspects = reviewAspects(est);
  const d = est.rating.design.score;
  const t = est.rating.tech.score;
  return OUTLETS.map((o) => {
    const raw = est.score + o.bias + o.focus * (d - t) * 0.15 + rng.normal(0, 0.3);
    const score = clamp(Math.round(raw * 2) / 2, 0, 10);
    const pool: [ReviewAspect, number][] = o.focus > 0 ? aspects.design : o.focus < 0 ? aspects.tech : aspects.value;
    const good = score >= 6.5;
    const sorted = [...pool].sort((a, b) => (good ? b[1] - a[1] : a[1] - b[1]));
    return { outletId: o.id, score, quote: `${good ? 'good' : 'bad'}.${sorted[0][0]}` };
  });
}

function launch(state: GameState): SimEvent[] {
  if (!state.dev) {
    // Tutorial shortcut: launching straight from the editor builds the prototype first.
    if (!isFirstLaunch(state)) return [{ type: 'rejected', reason: 'notReady' }];
    startDev(state);
  }
  const dev = state.dev!;
  if (!dev.done) return [{ type: 'rejected', reason: 'notReady' }];

  const rng = createRng(state.rng);
  const year = yearOf(state.day);
  const design = dev.design;
  const est = reviewEstimate(design, year, { tutorial: isFirstLaunch(state) });
  const review: ReviewResult = {
    score: est.score,
    design: Math.round(est.rating.design.score * 10) / 10,
    tech: Math.round(est.rating.tech.score * 10) / 10,
    p: est.rating.p,
    value: est.value,
    cards: makeCards(rng, est),
  };
  state.rng = rng.state;

  const product: Product = {
    id: state.nextProductId++,
    design,
    launchDay: state.day,
    review,
    unitCost: unitCost(design),
    unitsSold: 0,
    revenue: 0,
    profit: 0,
    lastWeekUnits: 0,
    weekUnits: 0,
    carry: 0,
    active: true,
    capped: false,
  };

  // Preorders: fans plus the first week of organic demand (GDD §7.4).
  const brand = state.company.brand;
  const a = attractiveness({ design, review: review.score, brand, weeksSinceLaunch: 0 }, year);
  const others = activeInSegment(state, design.segment).map((p) => productA(state, p, year));
  const demand = weeklyDemand([a, ...others], design.segment, year, GARAGE_REACH)[0];
  const preorderUnits = Math.max(1, Math.round(state.company.fans * 0.2 * (review.score / 10) + demand));
  const preorderRevenue = preorderUnits * design.price;
  sell(state, product, preorderUnits);

  state.products.push(product);
  state.dev = null;
  state.stats.launches += 1;
  state.stats.bestReview = Math.max(state.stats.bestReview, review.score);

  const k = 10 * review.score > brand ? 0.25 : 0.35;
  const brandDelta = k * (10 * review.score - brand);
  state.company.brand = clamp(brand + brandDelta, 0, 100);

  // Next draft: same line, next number, today's kit.
  const word = design.name.replace(/\s*\d+$/, '');
  state.draft = { ...design, name: `${word} ${state.stats.launches + 1}`, kitYear: Math.floor(year) };
  state.draft.price = suggestedPrice(state.draft, year);
  state.clockStarted = true;

  const events: SimEvent[] = [
    { type: 'launched', productId: product.id, preorderUnits, preorderRevenue, review, brandDelta },
  ];
  return events.concat(checkGoals(state));
}

function sell(state: GameState, product: Product, units: number): { revenue: number; profit: number } {
  const year = yearOf(state.day);
  const revenue = units * product.design.price;
  const profit = revenue - units * currentUnitCost(product, year);
  product.unitsSold += units;
  product.weekUnits += units;
  product.revenue += revenue;
  product.profit += profit;
  state.company.cash += profit;
  state.stats.unitsTotal += units;
  state.stats.revenueTotal += revenue;
  state.stats.profitTotal += profit;
  return { revenue, profit };
}

function activeInSegment(state: GameState, segment: Segment): Product[] {
  return state.products.filter((p) => p.active && p.design.segment === segment);
}

/** Current review of a product: launch review minus how much it has aged (GDD §5.12). */
export function currentReview(product: Product, year: number): number {
  const pNow = overallRating(product.design, year).p;
  return clamp(product.review.score - (product.review.p - pNow), 0, 10);
}

function productA(state: GameState, product: Product, year: number): number {
  return attractiveness(
    {
      design: product.design,
      review: currentReview(product, year),
      brand: state.company.brand,
      weeksSinceLaunch: (state.day - product.launchDay) / DAYS_PER_WEEK,
    },
    year,
  );
}

/** Advances the simulation by one day. */
export function advanceDay(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (!state.clockStarted) return events;
  state.day += 1;
  const year = yearOf(state.day);

  // Development (founder works in the garage).
  const dev = state.dev;
  if (dev && !dev.done) {
    for (const k of ['design', 'tech', 'software'] as const) {
      dev.progress[k] = Math.min(dev.required[k], dev.progress[k] + FOUNDER_POINTS_PER_DAY);
    }
    if (dev.progress.design >= dev.required.design && dev.progress.tech >= dev.required.tech && dev.progress.software >= dev.required.software) {
      dev.done = true;
      events.push({ type: 'devDone' });
    }
  }

  // Sales (made-to-order, garage capacity shared by all products).
  const active = state.products.filter((p) => p.active);
  const demands = new Map<number, number>();
  const segments = new Set(active.map((p) => p.design.segment));
  for (const seg of segments) {
    const list = active.filter((p) => p.design.segment === seg);
    const weekly = weeklyDemand(list.map((p) => productA(state, p, year)), seg, year, GARAGE_REACH);
    list.forEach((p, i) => demands.set(p.id, weekly[i] / DAYS_PER_WEEK));
  }
  const totalDaily = [...demands.values()].reduce((a, b) => a + b, 0);
  const capDaily = GARAGE_CAPACITY_WEEK / DAYS_PER_WEEK;
  const scale = totalDaily > capDaily ? capDaily / totalDaily : 1;
  let units = 0;
  let revenue = 0;
  let profit = 0;
  for (const p of active) {
    const want = (demands.get(p.id) ?? 0) * scale + p.carry;
    const n = Math.floor(want);
    p.carry = want - n;
    if (scale < 1) p.capped = true;
    if (n > 0) {
      const r = sell(state, p, n);
      units += n;
      revenue += r.revenue;
      profit += r.profit;
    }
  }
  if (units > 0) events.push({ type: 'sales', units, revenue, profit });

  // Week end.
  if (state.day % DAYS_PER_WEEK === 0) {
    state.company.cash -= GARAGE_UPKEEP_WEEK * inflation(Math.floor(year));
    for (const p of state.products) {
      if (!p.active) continue;
      const rCur = currentReview(p, year);
      state.company.fans += p.weekUnits * 0.05 * Math.max(0, rCur - 5);
      p.lastWeekUnits = p.weekUnits;
      p.weekUnits = 0;
      const ageWeeks = (state.day - p.launchDay) / DAYS_PER_WEEK;
      if (ageWeeks >= 4 && (p.lastWeekUnits < 1 || rCur < 2)) {
        p.active = false;
        events.push({ type: 'productRetired', productId: p.id });
      }
      if (scale >= 1) p.capped = false;
    }
    state.company.fans *= 0.995;
    state.company.brand *= 0.995;
    state.cashHistory.push(Math.round(state.company.cash));
    if (state.cashHistory.length > 104) state.cashHistory.shift();
    events.push({ type: 'weekEnd', week: state.day / DAYS_PER_WEEK });
  }

  return events.concat(checkGoals(state));
}

export interface Forecast {
  review: number;
  design: number;
  tech: number;
  designParts: ReturnType<typeof designScore>;
  techParts: ReturnType<typeof techScore>;
  unitCost: number;
  price: number;
  margin: number;
  devDays: number;
  devCost: number;
  weeklyUnits: number;
}

/** Live editor forecast (deterministic, no RNG). */
export function forecast(state: GameState, design: PhoneDesign = state.draft): Forecast {
  const year = yearOf(state.day);
  const d: PhoneDesign = { ...design, kitYear: Math.floor(year) };
  d.price = suggestedPrice(d, year);
  const est = reviewEstimate(d, year, { tutorial: isFirstLaunch(state) });
  const cost = unitCost(d);
  const a = attractiveness({ design: d, review: est.score, brand: state.company.brand, weeksSinceLaunch: 0 }, year);
  const others = activeInSegment(state, d.segment).map((p) => productA(state, p, year));
  const weekly = Math.min(GARAGE_CAPACITY_WEEK, weeklyDemand([a, ...others], d.segment, year, GARAGE_REACH)[0]);
  return {
    review: est.score,
    design: est.rating.design.score,
    tech: est.rating.tech.score,
    designParts: est.rating.design,
    techParts: est.rating.tech,
    unitCost: cost,
    price: d.price,
    margin: d.price - cost,
    devDays: isFirstLaunch(state) ? 0 : devDays(d),
    devCost: isFirstLaunch(state) ? 0 : devCost(d),
    weeklyUnits: weekly,
  };
}
