// Game rules: new game, player actions and the daily tick.

import { COLORS } from '../data/design';
import {
  CREDIT_BASE,
  CREDIT_REVENUE_SHARE,
  LOAN_BUFFER,
  LOAN_INTEREST_WEEK,
  LOAN_REPAY_SHARE,
  GARAGE_CAPACITY_WEEK,
  GARAGE_UPKEEP_WEEK,
  OEM_LEAD_DAYS,
  OPERATIONS_RATE,
  OEM_MIN_BATCH,
  OFFICE_PRICE,
  PRESENTATIONS,
  STORAGE_RATE,
  TECH_CATEGORIES,
} from '../data/components';
import { DAYS_PER_WEEK, inflation } from '../data/eras';
import { ALL_SEGMENTS, COMPETITORS, OUTLETS, type Segment } from '../data/market';
import { HOME_SHARE, regionById } from '../data/regions';
import { COMPANY_PREFIXES, COMPANY_SUFFIXES, PHONE_WORDS } from '../data/names';
import { defaultParts, LAST_GEN, partById } from '../data/parts';
import {
  attractivenessParts,
  devCost,
  priceFactor,
  marketSize,
  segmentDemand,
  unitCost,
  volumeDiscount,
} from './economy/market';
import type { SimEvent } from './events';
import { checkDaily, claimCalendar, claimDaily, dailySync, newDaily } from './daily';
import { applyFactoryAction, autoAssign, factoryWeek, newFactory, produceDay, returnsPenalty, type FactoryAction } from './factory';
import { addNews, newRivals, rivalEntries, tickRivalsDay, tickRivalsWeek } from './competitors';
import { cameraHype, choose, elasticityMultiplier, marketMultiplier, newEvents, productionCostMultiplier, tariffRegion, tickDirector } from './director';
import { applyWorldAction, newContracts, newRegions, productFit, regionReach, storeRent, tickContracts, type WorldAction } from './world';
import { checkGoals } from './goals';
import {
  availableFeatures,
  availableFinishes,
  availableMaterials,
  availableOs,
  availableParts,
  availableSegments,
  availableShapes,
  availableSizes,
  canMarket,
  channelCut,
  presentationLevel,
  reach,
  startResearch,
  tickResearch,
} from './research';
import { createRng, type Rng } from './rng';
import {
  clamp,
  designScore,
  featureAdjustment,
  overallRating,
  reviewAspects,
  roundPrice,
  reviewEstimate,
  suggestedPrice,
  techScore,
  type FeatureCheck,
  type ReviewAspect,
} from './scoring/score';
import { SAVE_VERSION, type GameState, type PhoneDesign, type Product, type ReviewCard, type ReviewResult } from './state';
import {
  applyTeamAction,
  buildingRent,
  devDaysFor,
  devRequired,
  marketingBoost,
  newTeam,
  payroll,
  refreshApplicants,
  studioPolish,
  teamQuality,
  teamRates,
  tickTeamDay,
  tickTeamWeek,
  type TeamAction,
} from './team';
import { LAB_LEVELS, OFFICE_LEVELS, STUDIO_LEVELS } from '../data/team';
import { yearOf } from './time';

export const START_CASH = 2_000;

function garageParts(year: number) {
  return defaultParts('std', Math.min(LAST_GEN, Math.floor(year)));
}

export function newGame(seed: number): GameState {
  const rng = createRng(seed);
  const company = `${rng.pick(COMPANY_PREFIXES)} ${rng.pick(COMPANY_SUFFIXES)}`;
  const word = rng.pick(PHONE_WORDS);
  const draft: PhoneDesign = {
    name: `${word} 1`,
    segment: 'mid',
    price: 0,
    customPrice: null,
    colorId: null,
    shapeId: 'round',
    displaySize: 3.5,
    materialId: 'plastic',
    finishId: 'gloss',
    osId: 'leafline',
    kitYear: 2007,
    parts: garageParts(2007),
    features: ['wifi'],
  };
  draft.price = suggestedPrice(draft, 2007);
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: rng.state,
    day: 0,
    clockStarted: false,
    company: { name: company, cash: START_CASH, brand: 0, fans: 0, debt: 0 },
    phase: 1,
    officeReady: false,
    phase3Ready: false,
    tutorial: 'color',
    draft,
    dev: null,
    products: [],
    nextProductId: 1,
    unlockedColors: COLORS.filter((c) => c.starter).map((c) => c.id),
    completedGoals: [],
    research: { done: [], current: null, budget: 0 },
    stats: { launches: 0, unitsTotal: 0, revenueTotal: 0, profitTotal: 0, bestReview: 0, bestLaunchHype: 0, hires: 0, trainings: 0, reorders: 0 },
    team: newTeam(),
    factory: newFactory(),
    phase4Ready: false,
    daily: newDaily(),
    cosmetics: [],
    history: { cash: [], revenue: [], profit: [], playerUnits: [], compUnits: {} },
    week: { revenue: 0, profit: 0, units: 0 },
    rivals: [],
    news: [],
    events: newEvents(),
    regions: newRegions(),
    contracts: newContracts(),
  };
  state.rivals = newRivals(state);
  return state;
}

export type DraftPatch = Partial<
  Pick<PhoneDesign, 'colorId' | 'shapeId' | 'displaySize' | 'name' | 'segment' | 'customPrice' | 'materialId' | 'finishId' | 'osId' | 'features'>
> & { part?: { category: (typeof TECH_CATEGORIES)[number]; id: string } };

export interface LaunchOptions {
  /** First production batch (Phase 2+). */
  batch?: number;
  marketing?: number;
  presentation?: number;
}

export type Action =
  | { type: 'setDraft'; patch: DraftPatch }
  | { type: 'setTutorial'; step: GameState['tutorial'] }
  | { type: 'startDev' }
  | { type: 'launch'; options?: LaunchOptions }
  | { type: 'renameCompany'; name: string }
  | { type: 'rentOffice' }
  | { type: 'startResearch'; id: string }
  | { type: 'orderBatch'; productId: number; units: number }
  | { type: 'discontinue'; productId: number }
  | { type: 'setLabBudget'; amount: number }
  | { type: 'debugCash'; amount: number }
  | { type: 'dailySync'; date: string }
  | { type: 'claimDaily'; index: number }
  | { type: 'claimCalendar'; date: string }
  | { type: 'repay'; amount: number }
  | { type: 'eventChoice'; option: string }
  | TeamAction
  | FactoryAction
  | WorldAction;

const WORLD_ACTIONS = new Set(['enterRegion', 'openStore', 'fulfilContract', 'declineContract']);

const FACTORY_ACTIONS = new Set(['buildFactory', 'growFactory', 'addLine', 'upgradeLine', 'assignLine', 'pauseLine', 'setTempo', 'upgradeWarehouse', 'setTargetWeeks']);

export function isFirstLaunch(state: GameState): boolean {
  return state.stats.launches === 0;
}

/** Keeps a draft consistent with what the company can currently build. */
export function normalizeDraft(state: GameState, d: PhoneDesign): void {
  const year = yearOf(state.day);
  d.kitYear = Math.floor(year);
  if (state.phase < 2) {
    d.parts = garageParts(year);
    d.features = ['wifi'];
    d.segment = 'mid';
    d.customPrice = null;
    d.materialId = 'plastic';
    d.finishId = 'gloss';
    d.osId = 'leafline';
  } else {
    for (const c of TECH_CATEGORIES) {
      const avail = availableParts(state, c);
      if (!avail.some((p) => p.id === d.parts[c])) d.parts[c] = avail[avail.length - 1].id;
    }
    const feats = availableFeatures(state);
    d.features = d.features.filter((f) => feats.includes(f));
    if (!availableMaterials(state).includes(d.materialId)) d.materialId = 'plastic';
    if (!availableFinishes(state).includes(d.finishId)) d.finishId = 'gloss';
    if (!availableOs(state).includes(d.osId)) d.osId = 'leafline';
    if (!availableSegments(state).includes(d.segment)) d.segment = 'mid';
  }
  if (!availableShapes(state).includes(d.shapeId)) d.shapeId = 'round';
  if (!availableSizes(state).includes(d.displaySize)) d.displaySize = 3.5;
  if (d.customPrice !== null) d.customPrice = clamp(Math.round(d.customPrice), 29, 4999);
  d.price = d.customPrice ?? autoPrice(state, d);
}

/** Minimum margin the automatic price keeps after the shops' cut. */
export const AUTO_MARGIN = 1.3;

/**
 * Automatic shelf price: the market's fair suggestion, but never below what it costs
 * to build and sell the phone (unit cost / (1 − channel cut) × margin).
 */
export function autoPrice(state: GameState, d: PhoneDesign): number {
  const year = yearOf(state.day);
  const fair = suggestedPrice(d, year);
  if (state.phase < 2) return fair;
  const cost = unitCost(d, year, 'oem');
  const floor = roundPrice((cost / (1 - channelCut(state))) * AUTO_MARGIN);
  return Math.max(fair, floor);
}

/** Applies a player action. Mutates `state` and returns emitted events. */
export function applyAction(state: GameState, action: Action): SimEvent[] {
  switch (action.type) {
    case 'setDraft': {
      const { part, ...rest } = action.patch;
      Object.assign(state.draft, rest);
      if (part) state.draft.parts = { ...state.draft.parts, [part.category]: part.id };
      normalizeDraft(state, state.draft);
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
      return launch(state, action.options ?? {});
    case 'rentOffice':
      return rentOffice(state);
    case 'startResearch':
      return startResearch(state, action.id);
    case 'orderBatch':
      return orderBatch(state, action.productId, action.units, OEM_LEAD_DAYS);
    case 'discontinue':
      return discontinue(state, action.productId);
    case 'setLabBudget':
      state.research.budget = Math.max(0, Math.round(action.amount));
      return [];
    case 'dailySync':
      return dailySync(state, action.date).concat(checkDaily(state));
    case 'claimDaily':
      return claimDaily(state, action.index).concat(checkGoals(state));
    case 'repay':
      return repay(state, action.amount).concat(checkGoals(state));
    case 'claimCalendar':
      return claimCalendar(state, action.date).concat(checkGoals(state));
    case 'eventChoice':
      return choose(state, action.option).concat(checkGoals(state));
    default:
      if (WORLD_ACTIONS.has(action.type)) {
        const year = yearOf(state.day);
        return applyWorldAction(state, action as WorldAction, (p) => currentReview(p, year)).concat(checkGoals(state), checkDaily(state));
      }
      if (FACTORY_ACTIONS.has(action.type)) {
        const ev = applyFactoryAction(state, action as FactoryAction);
        if (ev.some((e) => e.type === 'factoryBuilt')) normalizeDraft(state, state.draft);
        return ev.concat(checkGoals(state), checkDaily(state));
      }
      return applyTeamAction(state, action as TeamAction).concat(checkGoals(state), checkDaily(state));
  }
}

function rentOffice(state: GameState): SimEvent[] {
  if (state.phase >= 2 || !state.officeReady) return [{ type: 'rejected', reason: 'notReady' }];
  const price = OFFICE_PRICE * inflation(Math.floor(yearOf(state.day)));
  if (state.company.cash < price) return [{ type: 'rejected', reason: 'noCash' }];
  state.company.cash -= price;
  state.phase = 2;
  state.team.office = 1;
  refreshApplicants(state);
  normalizeDraft(state, state.draft);
  return [{ type: 'officeRented' } as SimEvent].concat(checkGoals(state));
}

function startDev(state: GameState): SimEvent[] {
  if (state.dev) return [{ type: 'rejected', reason: 'busy' }];
  const design: PhoneDesign = structuredClone(state.draft);
  normalizeDraft(state, design);
  if (isFirstLaunch(state)) {
    // Tutorial: the first prototype is built overnight for free (GDD §19).
    const req = devRequired(state, design);
    state.dev = { design, required: req, progress: { ...req }, done: true };
    return [{ type: 'devDone' }];
  }
  const cost = devCost(design);
  if (state.company.cash < cost) return [{ type: 'rejected', reason: 'noCash' }];
  state.company.cash -= cost;
  state.dev = { design, required: devRequired(state, design), progress: { design: 0, tech: 0, software: 0 }, done: false };
  return [{ type: 'devStarted', days: devDaysFor(state, design), cost }];
}

/** Team quality and studio polish for a review (GDD §5.8). */
function reviewOpts(state: GameState, hype: number) {
  return { tutorial: isFirstLaunch(state), hype, q: teamQuality(state), bonus: studioPolish(state) };
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

/** Weekly running costs (rent, payroll, lab budget) – used for the cash reserve. */
export function weeklyCosts(state: GameState): number {
  const inf = inflation(Math.floor(yearOf(state.day)));
  return state.phase >= 2 ? buildingRent(state) + payroll(state) + state.research.budget + state.factory.invested * 0.01 + storeRent(state) : GARAGE_UPKEEP_WEEK * inf;
}

/** Cash the company keeps before spare money goes to the bank. */
export function cashReserve(state: GameState): number {
  return Math.max(LOAN_BUFFER * inflation(Math.floor(yearOf(state.day))) * 1.5, 4 * weeklyCosts(state));
}

/** Pays back up to `amount` of the bank loan from cash. */
function repay(state: GameState, amount: number): SimEvent[] {
  const paid = Math.min(Math.max(0, amount), state.company.debt, Math.max(0, state.company.cash));
  if (paid <= 0) return [{ type: 'rejected', reason: state.company.debt <= 0 ? 'notReady' : 'noCash' }];
  state.company.debt -= paid;
  state.company.cash -= paid;
  if (state.company.debt < 1) state.company.debt = 0;
  return [{ type: 'repaid', amount: paid }];
}

/** Money the bank will lend for production right now. */
export function creditAvailable(state: GameState): number {
  if (state.phase < 2) return 0;
  const revenue52 = state.history.revenue.reduce((a, b) => a + b, 0);
  const limit = CREDIT_BASE * inflation(Math.floor(yearOf(state.day))) + CREDIT_REVENUE_SHARE * revenue52;
  return Math.max(0, limit - state.company.debt);
}

/**
 * Pays `amount`, borrowing the part of a production batch that cash can't cover.
 * `minFinance` is always lent (a minimum batch), so a company can never deadlock.
 */
function payWithCredit(state: GameState, amount: number, financeable: number, minFinance = 0): boolean {
  const shortfall = Math.max(0, amount - state.company.cash);
  if (shortfall > Math.min(financeable, Math.max(minFinance, creditAvailable(state)))) return false;
  state.company.cash += shortfall;
  state.company.debt += shortfall;
  state.company.cash -= amount;
  return true;
}

/** Marketing cost scale C_m (GDD §7.4). */
export function marketingScale(state: GameState): number {
  const year = yearOf(state.day);
  return 5000 * (marketSize(year) / marketSize(2007)) * (Math.max(reach(state), 0.01) / 0.01) * inflation(Math.floor(year));
}

export function presentationCost(level: number, year: number): number {
  return (PRESENTATIONS[level]?.cost ?? 0) * inflation(Math.floor(year));
}

/** Hype a launch would generate (GDD §7.4). */
export function launchHype(state: GameState, marketing: number, presentation: number, design: PhoneDesign): number {
  const fromMarketing = marketing > 0 ? 25 * Math.log2(1 + marketing / marketingScale(state)) : 0;
  const fc = featureAdjustment(design, yearOf(state.day));
  const stage = PRESENTATIONS[presentation]?.hype ?? 0;
  // Something genuinely new on stage makes a bigger splash.
  const fromStage = stage * (1 + 0.25 * fc.innovative.length);
  return clamp((fromMarketing + fromStage) * marketingBoost(state), 0, 100);
}

export function batchCost(design: PhoneDesign, units: number, year: number, costMul = 1): number {
  return unitCost(design, year, 'oem') * volumeDiscount(units) * units * costMul;
}

export interface LaunchQuote {
  hype: number;
  marketing: number;
  presentation: number;
  presentationCost: number;
  batch: number;
  batchCost: number;
  total: number;
}

export function launchQuote(state: GameState, design: PhoneDesign, opts: LaunchOptions): LaunchQuote {
  const year = yearOf(state.day);
  const marketing = canMarket(state) ? Math.max(0, opts.marketing ?? 0) : 0;
  const presentation = clamp(Math.floor(opts.presentation ?? 0), 0, presentationLevel(state));
  // With an own factory the first batch is optional: the lines build the stock.
  const factoryOnly = state.factory.size > 0 && opts.batch === 0;
  const batch = state.phase >= 2 && !factoryOnly ? Math.max(OEM_MIN_BATCH, Math.round(opts.batch ?? OEM_MIN_BATCH)) : 0;
  // Trade-fair invitation: the next stage show costs half and draws a bigger crowd.
  const fair = state.events.tradeFair && presentation > 0;
  const pCost = presentationCost(presentation, year) * (fair ? 0.5 : 1);
  const bCost = batch ? batchCost(design, batch, year, productionCostMultiplier(state)) : 0;
  return {
    hype: Math.min(100, launchHype(state, marketing, presentation, design) + (fair ? 20 : 0)),
    marketing,
    presentation,
    presentationCost: pCost,
    batch,
    batchCost: bCost,
    total: marketing + pCost + bCost,
  };
}

function launch(state: GameState, opts: LaunchOptions): SimEvent[] {
  if (!state.dev) {
    // Tutorial shortcut: launching straight from the editor builds the prototype first.
    if (!isFirstLaunch(state)) return [{ type: 'rejected', reason: 'notReady' }];
    startDev(state);
  }
  const dev = state.dev!;
  if (!dev.done) return [{ type: 'rejected', reason: 'notReady' }];
  const year = yearOf(state.day);
  const design = dev.design;
  normalizeDraft(state, design);
  const quote = launchQuote(state, design, opts);
  // Marketing and stage need cash; the bank will finance the production batch.
  const minBatch = quote.batch ? batchCost(design, OEM_MIN_BATCH, year) : 0;
  if (!payWithCredit(state, quote.total, quote.batchCost, minBatch)) return [{ type: 'rejected', reason: 'noCash' }];

  const rng = createRng(state.rng);
  if (quote.presentation > 0 && state.events.tradeFair) state.events.tradeFair = false;
  // Influencer review (GDD §13): 5 % of launches get a free hype push.
  if (state.stats.launches >= 2 && rng.next() < 0.05) {
    quote.hype = Math.min(100, quote.hype + 15);
    addNews(state, { kind: 'event.influencer', text: design.name });
  }
  const est = reviewEstimate(design, year, reviewOpts(state, quote.hype));
  const review: ReviewResult = {
    score: est.score,
    design: Math.round(est.rating.design.score * 10) / 10,
    tech: Math.round(est.rating.tech.score * 10) / 10,
    p: est.rating.p,
    value: est.value,
    cards: makeCards(rng, est),
  };
  state.rng = rng.state;

  const madeToOrder = state.phase < 2;
  const product: Product = {
    id: state.nextProductId++,
    design,
    launchDay: state.day,
    review,
    unitCost: madeToOrder ? unitCost(design, year, 'garage') : quote.batch ? unitCost(design, year, 'oem') * volumeDiscount(quote.batch) : unitCost(design, year, 'factory'),
    unitsSold: 0,
    revenue: 0,
    profit: 0,
    lastWeekUnits: 0,
    weekUnits: 0,
    weekDemand: 0,
    lastWeekDemand: 0,
    carry: 0,
    active: true,
    capped: false,
    madeToOrder,
    stock: quote.batch,
    backlog: 0,
    orders: [],
    hype: quote.hype,
    launchHype: quote.hype,
  };

  // Pre-orders: fans plus the first week of organic demand (GDD §7.4).
  const brand = state.company.brand;
  const demand = productDemand(state, product, [product, ...activeInSegment(state, design.segment)]);
  const wanted = Math.max(1, Math.round(state.company.fans * 0.2 * (review.score / 10) * (1 + quote.hype / 100) + demand));
  const preorderUnits = madeToOrder ? wanted : Math.min(wanted, product.stock);
  if (!madeToOrder) {
    product.stock -= preorderUnits;
    product.backlog = (wanted - preorderUnits) * 0.5;
  }
  sell(state, product, preorderUnits, true);

  state.products.push(product);
  const lineId = state.factory.size > 0 ? autoAssign(state, product.id) : null;
  state.dev = null;
  state.stats.launches += 1;
  state.stats.bestReview = Math.max(state.stats.bestReview, review.score);
  state.stats.bestLaunchHype = Math.max(state.stats.bestLaunchHype, quote.hype);

  const k = 10 * review.score > brand ? 0.25 : 0.35;
  const brandDelta = k * (10 * review.score - brand);
  state.company.brand = clamp(brand + brandDelta, 0, 100);
  // Over-hyped disappointments cost fans (GDD §7.5).
  const hypePenalty = 0.3 * Math.max(0, 5 + (4 * quote.hype) / 100 - review.p);
  if (hypePenalty > 0) state.company.fans *= 1 - 0.1 * hypePenalty;

  // Next draft: same line, next number.
  const word = design.name.replace(/\s*\d+$/, '');
  state.draft = { ...structuredClone(design), name: `${word} ${state.stats.launches + 1}` };
  normalizeDraft(state, state.draft);
  state.clockStarted = true;

  const events: SimEvent[] = [
    {
      type: 'launched',
      productId: product.id,
      preorderUnits,
      preorderRevenue: preorderUnits * design.price * (1 - channelCut(state)),
      review,
      brandDelta,
      hype: quote.hype,
      spend: quote.total,
      lineId,
    },
  ];
  return events.concat(checkGoals(state));
}

function orderBatch(state: GameState, productId: number, units: number, leadDays: number): SimEvent[] {
  const p = state.products.find((x) => x.id === productId);
  if (!p || !p.active || p.madeToOrder) return [{ type: 'rejected', reason: 'notReady' }];
  const year = yearOf(state.day);
  const requested = Math.max(OEM_MIN_BATCH, Math.round(units));
  const minCost = batchCost(p.design, OEM_MIN_BATCH, year);
  // Cash plus what the bank will lend; a minimum batch is always financed.
  const maxCost = state.company.cash + Math.max(minCost, creditAvailable(state));
  units = requested;
  // Too big for the budget: order the largest batch we can pay for instead of nothing.
  while (units > OEM_MIN_BATCH && batchCost(p.design, units, year) > maxCost) {
    units = Math.max(OEM_MIN_BATCH, Math.floor((units * 0.9) / 50) * 50);
  }
  const cost = batchCost(p.design, units, year, productionCostMultiplier(state));
  if (!payWithCredit(state, cost, cost, minCost)) return [{ type: 'rejected', reason: 'noCash' }];
  p.orders.push({ units, arriveDay: state.day + leadDays });
  state.stats.reorders += 1;
  return [{ type: 'orderPlaced', productId, units, cost, requested }];
}

function discontinue(state: GameState, productId: number): SimEvent[] {
  const p = state.products.find((x) => x.id === productId);
  if (!p || !p.active) return [];
  // Clearance: remaining stock goes for 40 % of its cost (GDD §7.6).
  const value = p.stock * unitCost(p.design, yearOf(state.day), 'oem') * 0.4;
  state.company.cash += value;
  p.stock = 0;
  p.backlog = 0;
  p.orders = [];
  p.active = false;
  return [{ type: 'productRetired', productId }];
}

function sell(state: GameState, product: Product, units: number, preorder = false): { revenue: number; profit: number } {
  const year = yearOf(state.day);
  // Shelf price minus what the sales channel keeps.
  const revenue = units * product.design.price * (1 - channelCut(state));
  // Accounting profit always subtracts the unit cost. Cash: stock was already paid for
  // when produced, made-to-order pays parts per unit sold.
  const cost = units * (product.madeToOrder ? unitCost(product.design, year, 'garage') : product.unitCost);
  const profit = revenue - cost;
  product.unitsSold += units;
  product.weekUnits += units;
  product.revenue += revenue;
  product.profit += profit;
  state.company.cash += product.madeToOrder ? profit : revenue;
  state.stats.unitsTotal += units;
  state.stats.revenueTotal += revenue;
  state.stats.profitTotal += profit;
  state.week.revenue += revenue;
  state.week.profit += profit;
  state.week.units += units;
  void preorder;
  return { revenue, profit };
}

function activeInSegment(state: GameState, segment: Segment): Product[] {
  return state.products.filter((p) => p.active && p.design.segment === segment);
}

/** Current review of a product: launch review minus how much it has aged (GDD §5.12). */
export function currentReview(product: Product, year: number): number {
  const pNow = overallRating(product.design, year).p;
  return clamp(product.review.score - (product.review.p - pNow) - returnsPenalty(product), 0, 10);
}

function productA(state: GameState, product: Product, year: number): { a: number; ratio: number; eps: number } {
  const parts = attractivenessParts(
    {
      design: product.design,
      review: currentReview(product, year),
      brand: state.company.brand,
      weeksSinceLaunch: (state.day - product.launchDay) / DAYS_PER_WEEK,
      hype: product.hype,
    },
    year,
  );
  // Camera hype event: phones with a pro camera are the talk of the town.
  if (cameraHype(state) && partById(product.design.parts.camera)?.tier === 'pro') parts.a *= 1.2;
  return parts;
}

/**
 * Weekly demand of a segment's player products across all regions the company sells in,
 * plus each rival's units. Regions differ in size, taste, price sensitivity and reach.
 */
function regionalDemand(state: GameState, list: Product[], segment: Segment): { player: number[]; comps: Record<string, number> } {
  const year = yearOf(state.day);
  const base = reach(state);
  const parts = list.map((p) => productA(state, p, year));
  const player = list.map(() => 0);
  const comps: Record<string, number> = {};
  const tariff = tariffRegion(state);
  const epsMul = elasticityMultiplier(state);
  for (const id of state.regions.entered) {
    const region = regionById(id);
    const rm = regionReach(state, id, tariff === id);
    if (rm <= 0) continue;
    const m = region.priceSens * epsMul;
    const players = list.map((p, i) => {
      const pa = parts[i];
      const a = m === 1 ? pa.a : (pa.a / priceFactor(pa.ratio, pa.eps)) * priceFactor(pa.ratio, pa.eps * m);
      return { a: a * (id === 'home' && state.phase < 4 ? 1 : productFit(p, id)), reach: base * rm };
    });
    const boost = region.rivalBoost ?? {};
    const res = segmentDemand(players, segment, year, rivalEntries(state, segment, (rid) => boost[rid] ?? 1), (region.share / HOME_SHARE) * marketMultiplier(state));
    res.player.forEach((u, i) => (player[i] += u));
    for (const [k, v] of Object.entries(res.comps)) comps[k] = (comps[k] ?? 0) + v;
  }
  return { player, comps };
}

/** Weekly demand for `product` given all player products competing in its segment. */
function productDemand(state: GameState, product: Product, all: Product[]): number {
  const list = all.includes(product) ? all : [product, ...all];
  return regionalDemand(state, list, product.design.segment).player[list.indexOf(product)];
}

/** Valuation (GDD §7.8). */
export function valuation(state: GameState): number {
  const year = yearOf(state.day);
  const profit52 = state.history.profit.reduce((a, b) => a + b, 0);
  const t = state.team;
  const built =
    OFFICE_LEVELS.slice(0, t.office).reduce((a, l) => a + l.price, 0) +
    LAB_LEVELS.slice(0, t.lab).reduce((a, l) => a + l.price, 0) +
    STUDIO_LEVELS.slice(0, t.studio).reduce((a, l) => a + l.price, 0);
  const assets = built * 0.5 * inflation(Math.floor(year));
  const factory = state.factory.invested * 0.5;
  const stockValue = state.products.reduce((a, p) => a + (p.active && !p.madeToOrder ? p.stock * p.unitCost * 0.5 : 0), 0);
  return state.company.cash - state.company.debt + 4 * Math.max(0, profit52) + 2000 * state.company.brand * Math.sqrt(marketSize(year) / marketSize(2007)) + assets + factory + stockValue;
}

/** Market share of the player over the last 52 weeks (0–1). */
export function marketShare(state: GameState): number {
  const mine = state.history.playerUnits.reduce((a, b) => a + b, 0);
  let total = mine;
  for (const arr of Object.values(state.history.compUnits)) total += arr.reduce((a, b) => a + b, 0);
  return total > 0 ? mine / total : 0;
}

function pushHistory(arr: number[], v: number) {
  arr.push(Math.round(v));
  if (arr.length > 52) arr.shift();
}

/** Advances the simulation by one day. */
export function advanceDay(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (!state.clockStarted) return events;
  state.day += 1;
  const year = yearOf(state.day);

  // Development: founder and team.
  const dev = state.dev;
  if (dev && !dev.done) {
    const rates = teamRates(state);
    for (const k of ['design', 'tech', 'software'] as const) {
      dev.progress[k] = Math.min(dev.required[k], dev.progress[k] + rates[k]);
    }
    if (dev.progress.design >= dev.required.design && dev.progress.tech >= dev.required.tech && dev.progress.software >= dev.required.software) {
      dev.done = true;
      events.push({ type: 'devDone' });
    }
  }
  events.push(...tickResearch(state));
  events.push(...tickTeamDay(state));
  events.push(...tickRivalsDay(state));

  // Production orders arriving.
  for (const p of state.products) {
    if (!p.orders.length) continue;
    const arrived = p.orders.filter((o) => o.arriveDay <= state.day);
    if (!arrived.length) continue;
    p.orders = p.orders.filter((o) => o.arriveDay > state.day);
    const units = arrived.reduce((a, o) => a + o.units, 0);
    p.stock += units;
    events.push({ type: 'orderArrived', productId: p.id, units });
  }

  // Sales.
  const active = state.products.filter((p) => p.active);
  const daily = new Map<number, number>();
  const segments = new Set(active.map((p) => p.design.segment));
  for (const seg of segments) {
    const list = active.filter((p) => p.design.segment === seg);
    const res = regionalDemand(state, list, seg);
    list.forEach((p, i) => daily.set(p.id, res.player[i] / DAYS_PER_WEEK));
  }
  // Own factory lines refill stock before the day's sales.
  events.push(...produceDay(state, daily));
  // Garage capacity is shared by made-to-order products.
  const mtoDemand = active.filter((p) => p.madeToOrder).reduce((a, p) => a + (daily.get(p.id) ?? 0), 0);
  const capDaily = GARAGE_CAPACITY_WEEK / DAYS_PER_WEEK;
  const mtoScale = mtoDemand > capDaily ? capDaily / mtoDemand : 1;
  let units = 0;
  let revenue = 0;
  let profit = 0;
  for (const p of active) {
    let want = daily.get(p.id) ?? 0;
    if (p.madeToOrder) want *= mtoScale;
    want += p.carry;
    const fresh = Math.floor(want);
    p.carry = want - fresh;
    p.weekDemand += fresh;
    let sold: number;
    if (p.madeToOrder) {
      sold = fresh;
      if (mtoScale < 1) p.capped = true;
    } else {
      const queue = p.backlog + fresh;
      sold = Math.min(p.stock, Math.floor(queue));
      const fromBacklog = Math.min(p.backlog, sold);
      const unmetFresh = fresh - (sold - fromBacklog);
      p.backlog = Math.max(0, (p.backlog - fromBacklog) * 0.85 + unmetFresh * 0.3);
      if (p.stock > 0 && sold >= p.stock) events.push({ type: 'soldOut', productId: p.id });
      p.stock -= sold;
      if (unmetFresh > 0) p.capped = true;
    }
    if (sold > 0) {
      const res = sell(state, p, sold);
      units += sold;
      revenue += res.revenue;
      profit += res.profit;
    }
  }
  if (units > 0) events.push({ type: 'sales', units, revenue, profit });

  // Week end.
  if (state.day % DAYS_PER_WEEK === 0) {
    const inf = inflation(Math.floor(year));
    const rent = state.phase >= 2 ? buildingRent(state) + payroll(state) : GARAGE_UPKEEP_WEEK * inf;
    let storage = 0;
    for (const p of state.products) if (p.active && !p.madeToOrder) storage += p.stock * p.unitCost * STORAGE_RATE;
    const interest = state.company.debt * LOAN_INTEREST_WEEK;
    const operations = state.phase >= 2 ? state.week.revenue * OPERATIONS_RATE : 0;
    const lab = state.phase >= 2 ? state.research.budget : 0;
    const factory = factoryWeek(state) + storeRent(state);
    const costs = rent + storage + interest + operations + lab + factory;
    state.company.cash -= costs;
    state.week.profit -= costs;
    // The bank is paid back automatically: a share of a good week's profit, plus all
    // cash above a safety reserve (≈ 4 weeks of running costs).
    state.company.lastRepay = 0;
    if (state.company.debt > 0) {
      const fromProfit = Math.max(0, state.week.profit) * LOAN_REPAY_SHARE;
      const spare = state.company.cash - cashReserve(state);
      const repay = Math.min(state.company.debt, Math.max(fromProfit, spare), Math.max(0, state.company.cash));
      if (repay > 0) {
        state.company.debt -= repay;
        state.company.cash -= repay;
        state.company.lastRepay = repay;
      }
    }

    for (const p of state.products) {
      if (!p.active) continue;
      const rCur = currentReview(p, year);
      state.company.fans += p.weekUnits * 0.05 * Math.max(0, rCur - 5);
      p.lastWeekUnits = p.weekUnits;
      p.weekUnits = 0;
      p.lastWeekDemand = p.weekDemand;
      p.weekDemand = 0;
      p.hype *= 0.9;
      const ageWeeks = (state.day - p.launchDay) / DAYS_PER_WEEK;
      const empty = p.madeToOrder || (p.stock === 0 && p.orders.length === 0);
      // Sold out is not dead: retire only when nobody wants the phone any more.
      if (ageWeeks >= 4 && empty && (p.lastWeekDemand < 1 || rCur < 2)) {
        p.active = false;
        events.push({ type: 'productRetired', productId: p.id });
      }
      if (p.madeToOrder ? mtoScale >= 1 : p.backlog < 1) p.capped = false;
    }
    state.company.fans *= 0.995;
    state.company.brand *= 0.995;
    events.push(...tickTeamWeek(state));

    // Market history: player vs. competitors (weekly snapshot).
    const comps: Record<string, number> = {};
    const bySegment = new Map<Segment, { player: number; comps: Record<string, number> }>();
    for (const seg of ALL_SEGMENTS) {
      if (seg !== 'budget' && seg !== 'mid' && seg !== 'flagship' && state.phase < 4) continue;
      const list = state.products.filter((p) => p.active && p.design.segment === seg);
      const res = regionalDemand(state, list, seg);
      for (const [id, u] of Object.entries(res.comps)) comps[id] = (comps[id] ?? 0) + u;
      bySegment.set(seg, { player: res.player.reduce((a, b) => a + b, 0), comps: res.comps });
    }
    events.push(...tickRivalsWeek(state, bySegment));
    events.push(...tickDirector(state));
    events.push(...tickContracts(state));
    for (const c of [...COMPETITORS.map((c) => c.id), '_rest']) {
      state.history.compUnits[c] ??= [];
      pushHistory(state.history.compUnits[c], comps[c] ?? 0);
    }
    pushHistory(state.history.playerUnits, state.week.units);
    pushHistory(state.history.revenue, state.week.revenue);
    pushHistory(state.history.profit, state.week.profit);
    pushHistory(state.history.cash, state.company.cash);
    state.week = { revenue: 0, profit: 0, units: 0 };
    events.push({ type: 'weekEnd', week: state.day / DAYS_PER_WEEK });
  }

  // Bankruptcy protection: the bank steps in (GDD §24.3).
  if (state.company.cash < 0) {
    const amount = -state.company.cash + LOAN_BUFFER * inflation(Math.floor(year));
    state.company.cash += amount;
    state.company.debt += amount;
    events.push({ type: 'loan', amount });
  }

  return events.concat(checkGoals(state), checkDaily(state));
}

export interface Forecast {
  review: number;
  design: number;
  tech: number;
  designParts: ReturnType<typeof designScore>;
  techParts: ReturnType<typeof techScore>;
  features: FeatureCheck;
  unitCost: number;
  price: number;
  suggestedPrice: number;
  margin: number;
  channelCut: number;
  devDays: number;
  devCost: number;
  weeklyUnits: number;
  hype: number;
}

/** Live editor forecast (deterministic, no RNG). */
export function forecast(state: GameState, design: PhoneDesign = state.draft, launchOpts: LaunchOptions = {}): Forecast {
  const year = yearOf(state.day);
  const d: PhoneDesign = structuredClone(design);
  normalizeDraft(state, d);
  const hype = state.phase >= 2 ? launchHype(state, launchOpts.marketing ?? 0, launchOpts.presentation ?? 0, d) : 0;
  const est = reviewEstimate(d, year, reviewOpts(state, hype));
  const mode = state.factory.size > 0 ? 'factory' : state.phase >= 2 ? 'oem' : 'garage';
  const bestLine = state.factory.lines.reduce((a, l) => Math.max(a, l.level), 1);
  const cost = unitCost(d, year, mode, bestLine) * (mode === 'oem' ? volumeDiscount(launchOpts.batch ?? 1000) : 1);
  const temp: Product = {
    id: -1, design: d, launchDay: state.day, review: { score: est.score, design: 0, tech: 0, p: est.rating.p, value: est.value, cards: [] },
    unitCost: cost, unitsSold: 0, revenue: 0, profit: 0, lastWeekUnits: 0, weekUnits: 0, weekDemand: 0, lastWeekDemand: 0, carry: 0, active: true, capped: false,
    madeToOrder: state.phase < 2, stock: 0, backlog: 0, orders: [], hype, launchHype: hype,
  };
  let weekly = productDemand(state, temp, activeInSegment(state, d.segment));
  if (state.phase < 2) weekly = Math.min(GARAGE_CAPACITY_WEEK, weekly);
  return {
    review: est.score,
    design: est.rating.design.score,
    tech: est.rating.tech.score,
    designParts: est.rating.design,
    techParts: est.rating.tech,
    features: est.rating.features,
    unitCost: cost,
    price: d.price,
    suggestedPrice: suggestedPrice(d, year),
    margin: d.price * (1 - channelCut(state)) - cost,
    channelCut: channelCut(state),
    devDays: isFirstLaunch(state) ? 0 : devDaysFor(state, d),
    devCost: isFirstLaunch(state) ? 0 : devCost(d),
    weeklyUnits: weekly,
    hype,
  };
}

/** Weekly demand of an existing product right now (for re-order suggestions). */
export function currentDemand(state: GameState, product: Product): number {
  return productDemand(state, product, activeInSegment(state, product.design.segment));
}

