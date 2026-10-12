// Balancing bot (GDD §24.3). Plays headless through the public action API.

import { TECH_CATEGORIES, OFFICE_PRICE, PRESENTATIONS } from '../data/components';
import { inflation } from '../data/eras';
import type { Segment } from '../data/market';
import type { Tier } from '../data/parts';
import { RESEARCH } from '../data/research';
import {
  advanceDay,
  applyAction,
  creditAvailable,
  currentDemand,
  currentReview,
  forecast,
  launchQuote,
  marketShare,
  marketingScale,
  newGame,
  valuation,
} from './game';
import {
  availableFeatures,
  availableFinishes,
  availableMaterials,
  availableOs,
  availableParts,
  availableShapes,
  availableSizes,
  canMarket,
  presentationLevel,
  researchCost,
  researchStatus,
} from './research';
import { isTrendColor } from './scoring/score';
import type { GameState, PhoneDesign } from './state';
import { SECONDS_PER_DAY, calendar, yearOf } from './time';

export type BotProfile = 'average' | 'optimizer' | 'weak';

export interface BotSample {
  minute: number;
  date: string;
  phase: number;
  cash: number;
  valuation: number;
  launches: number;
  avgReview: number;
  unitsPerWeek: number;
  brand: number;
  fans: number;
  research: number;
  share: number;
}

export interface BotResult {
  samples: BotSample[];
  firstLaunchSec: number;
  officeReadyMin: number | null;
  officeRentedMin: number | null;
  phase3Min: number | null;
  final: GameState;
}

/** Speed mix: 40 % 1x, 30 % 2x, 30 % 4x, cycled in 10-minute blocks. */
function speedAt(sec: number, profile: BotProfile): number {
  if (profile === 'optimizer') return 4;
  const t = (sec / 60) % 10;
  return t < 4 ? 1 : t < 7 ? 2 : 4;
}

const TIER_FOR: Record<Segment, Tier> = { budget: 'lite', mid: 'std', flagship: 'pro' };

/** Builds the bot's best guess for a segment and returns it with its forecast. */
function designFor(state: GameState, segment: Segment, pick: number, profile: BotProfile): { design: PhoneDesign; score: number } {
  const year = yearOf(state.day);
  const d: PhoneDesign = structuredClone(state.draft);
  d.segment = segment;
  d.customPrice = null;
  const colors = state.unlockedColors;
  d.colorId = profile === 'weak' ? colors[pick % colors.length] : colors.find((c) => isTrendColor(c, year)) ?? colors[0];
  if (state.phase >= 2) {
    for (const c of TECH_CATEGORIES) {
      const parts = availableParts(state, c).filter((p) => p.tier === TIER_FOR[segment]);
      d.parts[c] = parts[parts.length - 1].id;
    }
    d.features = availableFeatures(state);
    const mats = availableMaterials(state);
    d.materialId = segment === 'budget' ? 'plastic' : mats[mats.length - 1];
    const fins = availableFinishes(state);
    d.finishId = fins[fins.length - 1];
    const os = availableOs(state);
    d.osId = segment === 'budget' ? 'leafline' : os[os.length - 1];
  }
  let best = d;
  let bestScore = -Infinity;
  const shapes = availableShapes(state);
  const sizes = availableSizes(state);
  for (const shapeId of shapes) {
    for (const displaySize of sizes) {
      const cand = { ...d, shapeId, displaySize };
      const f = forecast(state, cand, { batch: 2000 });
      const score = profile === 'weak' ? f.review + ((pick + shapeId.length + displaySize) % 3) : state.phase >= 2 ? f.weeklyUnits * f.margin : f.review;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
  }
  return { design: best, score: bestScore };
}

function chooseDesign(state: GameState, pick: number, profile: BotProfile): PhoneDesign {
  if (state.phase < 2) return designFor(state, 'mid', pick, profile).design;
  const segs: Segment[] = profile === 'weak' ? ['mid'] : ['budget', 'mid', 'flagship'];
  let best = designFor(state, segs[0], pick, profile);
  for (const s of segs.slice(1)) {
    const c = designFor(state, s, pick, profile);
    if (c.score > best.score) best = c;
  }
  return best.design;
}

function pickResearch(state: GameState, profile: BotProfile): string | null {
  const year = yearOf(state.day);
  let bestId: string | null = null;
  let best = -Infinity;
  for (const n of RESEARCH) {
    if (researchStatus(state, n) !== 'available') continue;
    const cost = researchCost(n, year);
    if (cost.money > state.company.cash * (profile === 'optimizer' ? 0.25 : 0.2)) continue;
    if (profile !== 'optimizer' && n.year > year) continue; // no pioneering
    const u = n.unlock;
    let prio = 1;
    if (u.reach) prio = 6;
    else if (u.marketing) prio = 5;
    else if (u.feature) prio = 4;
    else if (u.partGen) prio = u.partGen.category === 'chip' || u.partGen.category === 'display' ? 4 : 3;
    else if (u.material || u.os) prio = 3;
    else if (u.presentation) prio = 2;
    const score = prio / cost.rp;
    if (score > best) {
      best = score;
      bestId = n.id;
    }
  }
  return bestId;
}

export function runBot(opts: { minutes: number; seed: number; profile?: BotProfile; sampleEveryMin?: number }): BotResult {
  const profile = opts.profile ?? 'average';
  const state = newGame(opts.seed);
  const samples: BotSample[] = [];
  const marks = { officeReadyMin: null as number | null, officeRentedMin: null as number | null, phase3Min: null as number | null };
  let pick = opts.seed;

  // First minute: three taps in the tutorial (~8 s each), then launch.
  const firstLaunchSec = 33;
  applyAction(state, { type: 'setDraft', patch: chooseDesign(state, pick++, profile) });
  applyAction(state, { type: 'setTutorial', step: 'done' });
  applyAction(state, { type: 'launch' });

  const totalSec = opts.minutes * 60;
  const sampleEvery = (opts.sampleEveryMin ?? 5) * 60;
  let dayAcc = 0;
  let nextSample = 0;
  for (let sec = firstLaunchSec; sec <= totalSec; sec++) {
    dayAcc += speedAt(sec, profile) / SECONDS_PER_DAY;
    while (dayAcc >= 1) {
      dayAcc -= 1;
      advanceDay(state);
      botDecide(state, profile, () => pick++);
      const min = sec / 60;
      if (state.officeReady && marks.officeReadyMin === null) marks.officeReadyMin = min;
      if (state.phase >= 2 && marks.officeRentedMin === null) marks.officeRentedMin = min;
      if (state.phase3Ready && marks.phase3Min === null) marks.phase3Min = min;
    }
    if (sec >= nextSample) {
      samples.push(sample(state, sec / 60));
      nextSample += sampleEvery;
    }
  }
  return { samples, firstLaunchSec, ...marks, final: state };
}

function botDecide(state: GameState, profile: BotProfile, nextPick: () => number): void {
  const year = yearOf(state.day);
  const inf = inflation(Math.floor(year));

  if (state.phase < 2 && state.officeReady && state.company.cash >= OFFICE_PRICE * inf * 1.3) {
    applyAction(state, { type: 'rentOffice' });
  }
  const reserve = 4 * 3000 * inf;
  if (state.phase >= 2 && !state.research.current && state.company.cash > reserve) {
    const id = pickResearch(state, profile);
    if (id) applyAction(state, { type: 'startResearch', id });
  }

  // Re-orders: keep ~4 weeks of stock.
  for (const p of state.products) {
    if (!p.active || p.madeToOrder) continue;
    const demand = currentDemand(state, p);
    const pipeline = p.stock + p.orders.reduce((a, o) => a + o.units, 0);
    if (currentReview(p, year) >= 4.5 && pipeline < demand * 3 && demand > 5) {
      const units = Math.ceil(demand * 4);
      applyAction(state, { type: 'orderBatch', productId: p.id, units });
    }
  }

  if (state.dev?.done) {
    const f = forecast(state, state.dev.design, { batch: 1000 });
    const marketing = canMarket(state) && profile !== 'weak' ? Math.min(state.company.cash * 0.12, marketingScale(state) * 2) : 0;
    let presentation = profile !== 'weak' ? presentationLevel(state) : 0;
    while (presentation > 0 && PRESENTATIONS[presentation].cost * inf > state.company.cash * 0.15) presentation--;
    let batch = Math.max(100, Math.round(f.weeklyUnits * 5));
    let quote = launchQuote(state, state.dev.design, { batch, marketing, presentation });
    const budget = state.company.cash * 0.85 + creditAvailable(state) * 0.5;
    while (quote.total > budget && batch > 100) {
      batch = Math.max(100, Math.floor(batch * 0.7));
      quote = launchQuote(state, state.dev.design, { batch, marketing, presentation });
    }
    const ok = quote.total - quote.batchCost <= state.company.cash;
    applyAction(state, { type: 'launch', options: { batch, marketing: ok ? marketing : 0, presentation: ok ? presentation : 0 } });
    return;
  }
  if (state.dev) return;
  const latest = state.products[state.products.length - 1];
  const age = latest ? (state.day - latest.launchDay) / 7 : Infinity;
  const interval = profile === 'optimizer' ? 8 : profile === 'weak' ? 18 : 12;
  if (age < interval) return;
  applyAction(state, { type: 'setDraft', patch: chooseDesign(state, nextPick(), profile) });
  applyAction(state, { type: 'startDev' });
}

function sample(state: GameState, minute: number): BotSample {
  const cal = calendar(state.day);
  const reviews = state.products.slice(-5).map((p) => p.review.score);
  return {
    minute: Math.round(minute * 10) / 10,
    date: `W${cal.week} ${cal.year}`,
    phase: state.phase3Ready ? 3 : state.phase,
    cash: Math.round(state.company.cash),
    valuation: Math.round(valuation(state)),
    launches: state.stats.launches,
    avgReview: reviews.length ? Math.round((reviews.reduce((a, b) => a + b, 0) / reviews.length) * 10) / 10 : 0,
    unitsPerWeek: state.history.playerUnits[state.history.playerUnits.length - 1] ?? 0,
    brand: Math.round(state.company.brand),
    fans: Math.round(state.company.fans),
    research: state.research.done.length,
    share: Math.round(marketShare(state) * 1000) / 10,
  };
}
