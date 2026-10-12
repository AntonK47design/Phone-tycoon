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
  availableSegments,
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
import { buildFactoryCost, factorySizeCost, lineRate, lineUpgradeCost, newLineCost, stockTotal, warehouseCost } from './factory';
import { warehouseCapacity } from '../data/factory';
import { REGIONS } from '../data/regions';
import { contractProblem, entryCost, storeCost } from './world';
import {
  bonusCost,
  bonusReady,
  expectedSkill,
  hireFee,
  isWorking,
  labCost,
  officeUpgradeCost,
  payroll,
  rolesAvailable,
  salary,
  seats,
  studioCost,
  trainingCost,
} from './team';
import type { Role } from '../data/team';
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
  staff: number;
  payroll: number;
  office: number;
  lines: number;
  produced: number;
  regions: number;
  stores: number;
}

export interface BotResult {
  samples: BotSample[];
  firstLaunchSec: number;
  officeReadyMin: number | null;
  officeRentedMin: number | null;
  phase3Min: number | null;
  factoryMin: number | null;
  phase4Min: number | null;
  final: GameState;
}

/** Speed mix: 40 % 1x, 30 % 2x, 30 % 4x, cycled in 10-minute blocks. */
function speedAt(sec: number, profile: BotProfile): number {
  if (profile === 'optimizer') return 4;
  const t = (sec / 60) % 10;
  return t < 4 ? 1 : t < 7 ? 2 : 4;
}

const TIER_FOR: Record<Segment, Tier> = { budget: 'lite', mid: 'std', flagship: 'pro', senior: 'lite', gaming: 'pro' };

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
  const segs: Segment[] = profile === 'weak' ? ['mid'] : availableSegments(state);
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
    else if (u.material || u.os || u.sizes || u.shape) prio = 3;
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
  const marks = { officeReadyMin: null as number | null, officeRentedMin: null as number | null, phase3Min: null as number | null, factoryMin: null as number | null, phase4Min: null as number | null };
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
      if (state.factory.size > 0 && marks.factoryMin === null) marks.factoryMin = min;
      if (state.phase4Ready && marks.phase4Min === null) marks.phase4Min = min;
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
  // Lab budget: a share of recent profit, never more than cash can carry.
  if (state.phase >= 2 && state.day % 28 === 0) {
    const recent = state.history.profit.slice(-4);
    const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const share = profile === 'optimizer' ? 0.35 : profile === 'weak' ? 0.1 : 0.25;
    applyAction(state, { type: 'setLabBudget', amount: Math.max(0, Math.min(avg * share, state.company.cash / 30)) });
  }
  if (state.phase >= 2) manageTeam(state, profile);
  if (state.phase3Ready) manageFactory(state, profile);
  if (state.phase4Ready) manageWorld(state, profile);
  const pending = state.events.pending;
  if (pending) {
    const care = profile === 'weak' ? 8 : 3;
    const pay = pending.options[0];
    applyAction(state, { type: 'eventChoice', option: state.company.cash > (pending.amount ?? 0) * care ? pay : pending.options[pending.options.length - 1] });
  }
  const reserve = 4 * 3000 * inf;
  if (state.phase >= 2 && !state.research.current && state.company.cash > reserve) {
    const id = pickResearch(state, profile);
    if (id) applyAction(state, { type: 'startResearch', id });
  }

  // Re-orders: keep ~4 weeks of stock.
  for (const p of state.products) {
    if (!p.active || p.madeToOrder) continue;
    if (state.factory.lines.some((l) => l.productId === p.id && !l.paused)) continue;
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
    // With a free factory line the bot lets the factory build the stock.
    const freeLine = state.factory.lines.some((l) => !state.products.some((p) => p.id === l.productId && p.active));
    let batch = freeLine ? 0 : Math.max(100, Math.round(f.weeklyUnits * 5));
    let quote = launchQuote(state, state.dev.design, { batch, marketing, presentation });
    const budget = state.company.cash * 0.85 + creditAvailable(state) * 0.5;
    while (quote.total > budget && batch > 100 && !freeLine) {
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

/** Target team mix per seat. */
const MIX: Record<Role, number> = { designer: 0.2, engineer: 0.3, programmer: 0.2, researcher: 0.2, marketer: 0.1, producer: 0.08 };

function manageTeam(state: GameState, profile: BotProfile): void {
  const year = yearOf(state.day);
  const team = state.team;
  const care = profile === 'optimizer' ? 1 : profile === 'weak' ? 2.5 : 1.5;
  const reserve = () => payroll(state) * 6 * care + 20_000 * inflation(Math.floor(year));
  const cap = seats(state);
  const recent = state.history.profit.slice(-8);
  const avgProfit = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;

  // Hire for the role with the biggest gap.
  if (team.staff.length < cap && team.applicants.length) {
    const roles = rolesAvailable(state);
    const total = roles.reduce((a, r) => a + MIX[r], 0);
    const gap = (r: Role) => (MIX[r] / total) * seats(state) - team.staff.filter((e) => e.role === r).length;
    const cands = [...team.applicants].sort((a, b) => gap(b.role) - gap(a.role) || b.skill / salary(b, year) - a.skill / salary(a, year));
    const pick = profile === 'weak' ? team.applicants[0] : cands[0];
    // Only hire what the weekly profit can carry (the Team panel shows this ratio too).
    const affordable = !!pick && avgProfit > salary(pick, year) * (profile === 'optimizer' ? 1 : 1.5);
    if (pick && affordable && state.company.cash - hireFee(pick, year) > reserve()) applyAction(state, { type: 'hire', id: pick.id });
  }
  // Losing money with an empty bank account: let the least productive person go.
  if (team.staff.length && avgProfit < 0 && recent.length >= 8 && state.company.cash < payroll(state) * 3) {
    const worst = [...team.staff].sort((a, b) => a.skill / salary(a, year) - b.skill / salary(b, year))[0];
    applyAction(state, { type: 'fire', id: worst.id });
  }
  // Grow the office once it is full.
  const up = officeUpgradeCost(state);
  if (up !== null && team.staff.length >= seats(state) && state.company.cash > up * (profile === 'optimizer' ? 1.8 : profile === 'weak' ? 4 : 2.5)) {
    applyAction(state, { type: 'upgradeOffice' });
  }
  const lab = labCost(state);
  if (lab !== null && team.office >= 2 && state.company.cash > lab * 3 * care) applyAction(state, { type: 'buildLab' });
  const studio = studioCost(state);
  if (studio !== null && team.office >= 2 && state.company.cash > studio * 3 * care) applyAction(state, { type: 'buildStudio' });

  // Training keeps the team up with the era (weak bots never train).
  {
    const busy = team.staff.filter((e) => !isWorking(e, state.day)).length;
    const lagging = team.staff.filter((e) => isWorking(e, state.day) && e.skill < expectedSkill(year) + (profile === 'optimizer' ? 15 : profile === 'weak' ? -5 : 5)).sort((a, b) => a.skill - b.skill)[0];
    if (lagging && busy < Math.max(1, team.staff.length / 4) && state.company.cash > trainingCost(lagging, year) * care + reserve()) {
      applyAction(state, { type: 'train', id: lagging.id });
    }
  }
  // Bonus when spirits sag.
  const avgMorale = team.staff.reduce((a, e) => a + e.morale, 0) / Math.max(1, team.staff.length);
  if (profile !== 'weak' && avgMorale < 55 && bonusReady(state) && state.company.cash > bonusCost(state) * 6) applyAction(state, { type: 'payBonus' });
}

function manageFactory(state: GameState, profile: BotProfile): void {
  const care = profile === 'optimizer' ? 1.5 : profile === 'weak' ? 3 : 2;
  const f = state.factory;
  if (f.size === 0) {
    if (state.phase >= 2 && state.company.cash > buildFactoryCost(state) * care) applyAction(state, { type: 'buildFactory' });
    return;
  }
  if (state.day % 7 !== 3) return;
  const active = state.products.filter((p) => p.active && !p.madeToOrder);
  const demand = new Map(active.map((p) => [p.id, currentDemand(state, p)]));
  // Lines go to the best sellers.
  const top = active.filter((p) => demand.get(p.id)! > 20).sort((a, b) => demand.get(b.id)! - demand.get(a.id)!).slice(0, f.lines.length);
  const topIds = new Set(top.map((p) => p.id));
  const keep = new Set(f.lines.filter((l) => l.productId !== null && topIds.has(l.productId)).map((l) => l.productId));
  const todo = top.filter((p) => !keep.has(p.id));
  for (const l of f.lines) {
    if (l.productId !== null && topIds.has(l.productId)) continue;
    const p = todo.shift();
    if (p) applyAction(state, { type: 'assignLine', id: l.id, productId: p.id });
  }
  const covered = new Set(f.lines.map((l) => l.productId));
  const uncovered = active.filter((p) => !covered.has(p.id) && demand.get(p.id)! > 200);
  if (uncovered.length) {
    const add = newLineCost(state);
    if (add !== null && state.company.cash > add * care * 1.5) applyAction(state, { type: 'addLine' });
    else {
      const grow = factorySizeCost(state);
      if (add === null && grow !== null && state.company.cash > grow * care * 1.5) applyAction(state, { type: 'growFactory' });
    }
  }
  // Upgrade lines that cannot keep up (or, for rich optimizers, to cut assembly cost).
  for (const l of f.lines) {
    const p = active.find((x) => x.id === l.productId);
    const cost = lineUpgradeCost(state, l);
    if (!p || cost === null) continue;
    const short = currentDemand(state, p) > lineRate(state, l) * 7 * 0.85;
    if ((short && state.company.cash > cost * care * 2) || state.company.cash > cost * care * 8) {
      applyAction(state, { type: 'upgradeLine', id: l.id });
    }
  }
  if (stockTotal(state) > warehouseCapacity(f.warehouse) * 0.8 && state.company.cash > warehouseCost(state) * care * 2) {
    applyAction(state, { type: 'upgradeWarehouse' });
  }
  if (profile === 'optimizer' && f.tempo !== 'quality' && state.team.staff.some((e) => e.role === 'producer')) applyAction(state, { type: 'setTempo', tempo: 'quality' });
}

function manageWorld(state: GameState, profile: BotProfile): void {
  if (state.day % 7 !== 5) return;
  const care = profile === 'optimizer' ? 1.5 : profile === 'weak' ? 4 : 2.5;
  const year = yearOf(state.day);
  // Cheapest region first.
  const next = REGIONS.filter((r) => !state.regions.entered.includes(r.id)).sort((a, b) => a.entry - b.entry)[0];
  if (next && state.company.cash > entryCost(state, next) * care) applyAction(state, { type: 'enterRegion', region: next.id });
  // Stores where they pay off most: the biggest entered region with the fewest stores.
  if (profile !== 'weak') {
    const target = state.regions.entered
      .map((id) => REGIONS.find((r) => r.id === id)!)
      .sort((a, b) => b.share / (1 + (state.regions.stores[b.id] ?? 0)) - a.share / (1 + (state.regions.stores[a.id] ?? 0)))[0];
    if (target && state.company.cash > storeCost(state, target.id) * care * 2) applyAction(state, { type: 'openStore', region: target.id });
  }
  // Contracts: deliver whenever a product qualifies.
  for (const c of [...state.contracts.offers]) {
    const p = state.products.find((x) => x.active && !contractProblem(state, c, x, currentReview(x, year)));
    if (p) applyAction(state, { type: 'fulfilContract', id: c.id, productId: p.id });
  }
}

function sample(state: GameState, minute: number): BotSample {
  const cal = calendar(state.day);
  const reviews = state.products.slice(-5).map((p) => p.review.score);
  return {
    minute: Math.round(minute * 10) / 10,
    date: `W${cal.week} ${cal.year}`,
    phase: state.phase >= 4 ? 4 : state.phase3Ready ? 3 : state.phase,
    cash: Math.round(state.company.cash),
    valuation: Math.round(valuation(state)),
    launches: state.stats.launches,
    avgReview: reviews.length ? Math.round((reviews.reduce((a, b) => a + b, 0) / reviews.length) * 10) / 10 : 0,
    unitsPerWeek: state.history.playerUnits[state.history.playerUnits.length - 1] ?? 0,
    brand: Math.round(state.company.brand),
    fans: Math.round(state.company.fans),
    research: state.research.done.length,
    share: Math.round(marketShare(state) * 1000) / 10,
    staff: state.team.staff.length,
    payroll: Math.round(payroll(state)),
    office: state.team.office,
    lines: state.factory.lines.reduce((a, l) => a + l.level, 0),
    produced: state.factory.produced,
    regions: state.regions.entered.length,
    stores: Object.values(state.regions.stores).reduce((a, b) => a + b, 0),
  };
}
