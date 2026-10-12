// Living competitors (GDD §12): eight rivals launch models on their own cadence, age,
// react to the player and drift up or down with their success.

import { DAYS_PER_WEEK } from '../data/eras';
import { COMPETITORS, curveAt, SEGMENTS, type CompetitorDef, type Segment } from '../data/market';
import { brandFactor, KAPPA, marketSize, type RivalEntry } from './economy/market';
import type { SimEvent } from './events';
import { createRng, type Rng } from './rng';
import { clamp, priceAnchor } from './scoring/score';
import type { GameState, NewsItem, RivalModel, RivalState } from './state';
import { yearOf } from './time';

/** Expectations rise ~30 %/year → a model loses ~1.1 review points per year on the shelf. */
export const RIVAL_AGING_PER_YEAR = 1.14;
/** A rival cuts prices when the player owns more than this share of a segment. */
export const DOMINANCE_SHARE = 0.3;
export const PRICE_CUT = 0.88;
export const PRICE_CUT_WEEKS = 26;
export const NEWS_KEEP = 40;

export function rivalDef(id: string): CompetitorDef {
  return COMPETITORS.find((c) => c.id === id)!;
}

/** Launch review of a new rival model (GDD §12). */
function modelReview(rng: Rng, def: CompetitorDef, rival: RivalState, year: number): number {
  const tau = Math.max(0.3, curveAt(def.tau, year) + rival.tauAdj);
  const budget = rival.brand / 100;
  return clamp(7.2 + 3 * Math.log2(tau * (1 + 0.1 * budget)) + 0.4 * def.designBias + rng.normal(0, 0.35), 1, 10);
}

function launchModel(rng: Rng, rival: RivalState, segment: Segment, day: number): RivalModel {
  const def = rivalDef(rival.id);
  const year = yearOf(day);
  rival.launches += 1;
  const review = Math.round(modelReview(rng, def, rival, year) * 10) / 10;
  const price = Math.round((priceAnchor({ segment }, year) * def.priceMul * Math.pow(review / 7, 1.2)) / 10) * 10 - 1;
  return { name: `${def.model}${rival.launches}`, segment, review, price, launchDay: day };
}

export function newRivals(state: GameState): RivalState[] {
  const rng = createRng(state.seed ^ 0x5eed);
  return COMPETITORS.map((def) => {
    const rival: RivalState = { id: def.id, brand: def.brand, tauAdj: 0, models: [], launches: 0, nextLaunch: 0, priceCutUntil: -1, scandalUntil: -1, unitsYear: 0, unitsLastYear: 0 };
    // Everyone starts with a model already on the shelf in each of their segments.
    for (const seg of def.segments) {
      const age = -Math.floor(rng.range(0, def.cadence * DAYS_PER_WEEK));
      rival.models.push(launchModel(rng, rival, seg, age));
    }
    rival.nextLaunch = Math.floor(rng.range(2, def.cadence) * DAYS_PER_WEEK);
    return rival;
  });
}

/** Current review of a rival model: launch review minus how much it has aged. */
export function rivalModelReview(m: RivalModel, day: number): number {
  const years = Math.max(0, day - m.launchDay) / (DAYS_PER_WEEK * 52);
  return clamp(m.review - RIVAL_AGING_PER_YEAR * years, 0, 10);
}

/** Effective attractiveness of every rival in a segment right now. */
export function rivalEntries(state: GameState, segment: Segment, regionMul: (id: string) => number = () => 1): RivalEntry[] {
  const year = yearOf(state.day);
  const out: RivalEntry[] = [];
  const eps = SEGMENTS[segment].elasticity;
  for (const r of state.rivals) {
    const def = rivalDef(r.id);
    const m = r.models.find((x) => x.segment === segment);
    if (!m) continue;
    const review = rivalModelReview(m, state.day);
    const weeks = (state.day - m.launchDay) / DAYS_PER_WEEK;
    const fresh = 1 + 0.4 * Math.exp(-weeks / 3);
    let price = Math.pow(1 / def.priceMul, eps);
    if (state.day < r.priceCutUntil) price *= Math.pow(1 / PRICE_CUT, eps);
    const brand = state.day < r.scandalUntil ? Math.max(0, r.brand - 20) : r.brand;
    const e = Math.pow(review / 10, KAPPA) * brandFactor(brand) * curveAt(def.reach, year) * clamp(price, 0.5, 2) * fresh * regionMul(r.id);
    out.push({ id: r.id, e });
  }
  return out;
}

export function addNews(state: GameState, item: Omit<NewsItem, 'day'>): void {
  state.news.push({ day: state.day, ...item });
  if (state.news.length > NEWS_KEEP) state.news.splice(0, state.news.length - NEWS_KEEP);
}

/** Daily: rivals launch new models on their cadence. */
export function tickRivalsDay(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const rng = createRng(state.rng);
  for (const r of state.rivals) {
    if (state.day < r.nextLaunch) continue;
    const def = rivalDef(r.id);
    // One segment per launch, the oldest model gets replaced.
    const oldest = [...r.models].sort((a, b) => a.launchDay - b.launchDay)[0];
    const model = launchModel(rng, r, oldest.segment, state.day);
    r.models = r.models.filter((m) => m !== oldest).concat(model);
    r.nextLaunch = state.day + Math.round((def.cadence / Math.max(1, def.segments.length / 1.5)) * rng.range(0.8, 1.2) * DAYS_PER_WEEK);
    addNews(state, { kind: 'rivalLaunch', rival: r.id, text: model.name, value: model.review, segment: model.segment });
    events.push({ type: 'rivalLaunch', rival: r.id, name: model.name, review: model.review });
  }
  state.rng = rng.state;
  return events;
}

/**
 * Weekly: reactions to a dominant player, unit counting; yearly brand and τ drift.
 * `segmentUnits` = this week's units per segment: player and per rival.
 */
export function tickRivalsWeek(state: GameState, segmentUnits: Map<Segment, { player: number; comps: Record<string, number> }>): SimEvent[] {
  const events: SimEvent[] = [];
  for (const [seg, res] of segmentUnits) {
    let total = res.player;
    for (const v of Object.values(res.comps)) total += v;
    for (const r of state.rivals) r.unitsYear += res.comps[r.id] ?? 0;
    if (total <= 0 || res.player / total <= DOMINANCE_SHARE) continue;
    // The strongest rival in that segment answers with a price cut.
    const top = Object.entries(res.comps)
      .filter(([id]) => id !== '_rest')
      .sort((a, b) => b[1] - a[1])[0];
    const rival = top && state.rivals.find((r) => r.id === top[0]);
    if (rival && state.day >= rival.priceCutUntil) {
      rival.priceCutUntil = state.day + PRICE_CUT_WEEKS * DAYS_PER_WEEK;
      addNews(state, { kind: 'priceCut', rival: rival.id, segment: seg, value: Math.round((1 - PRICE_CUT) * 100) });
      events.push({ type: 'rivalPriceCut', rival: rival.id, segment: seg });
    }
  }
  // Year end: brands follow their reviews, budgets follow success.
  if (state.day % (DAYS_PER_WEEK * 52) === 0) {
    const year = yearOf(state.day);
    // Units grow with the market anyway: judge success by growth against the market.
    const marketGrowth = marketSize(year) / marketSize(year - 1);
    for (const r of state.rivals) {
      const def = rivalDef(r.id);
      const avg = r.models.reduce((a, m) => a + m.review, 0) / Math.max(1, r.models.length);
      // Brands keep their identity and move with how good the phones are.
      r.brand = clamp(r.brand + 0.2 * (def.brand + 15 * (avg - 7) - r.brand), 5, 95);
      if (r.unitsLastYear > 0) {
        const growth = r.unitsYear / r.unitsLastYear / marketGrowth;
        r.tauAdj = clamp(r.tauAdj + (growth < 0.92 ? -0.03 : growth > 1.08 ? 0.02 : 0), -0.25, 0.08);
      }
      r.unitsLastYear = r.unitsYear;
      r.unitsYear = 0;
    }
  }
  return events;
}
