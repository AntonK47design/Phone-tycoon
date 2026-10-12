// Phase 5 – tech giant (GDD §15): campus, own chip and OS (projects, licences), side
// products and acquisitions of weak rivals.

import { DAYS_PER_WEEK, inflation } from '../data/eras';
import {
  CAMPUS_LEVELS,
  CAMPUS_UPKEEP,
  CHIP_FEE,
  chipProjectCost,
  chipRatio,
  OS_BASE_LIFE_WEEKS,
  OS_FEE,
  OS_HALF_BASE,
  osProjectCost,
  SIDE_MARGIN,
  SIDE_PRICE,
  SIDE_PRODUCTS,
  SIDE_TIER_BONUS,
  type SideKind,
  type SidePrice,
} from '../data/giant';
import type { Tier } from '../data/parts';
import { addNews } from './competitors';
import type { SimEvent } from './events';
import { clamp } from './scoring/score';
import type { GameState, GiantState, SideProduct } from './state';
import { teamRates } from './team';
import { yearOf } from './time';

export function newGiant(): GiantState {
  return {
    campus: 0,
    chip: { level: 0, project: null, licensing: false, licensees: [] },
    os: { level: 0, project: null, installed: 0, licensing: false, licensees: [] },
    side: { watch: null, earbuds: null, tablet: null },
    acquired: [],
    licenceWeek: 0,
  };
}

const inf = (state: GameState) => inflation(Math.floor(yearOf(state.day)));

export function campusCost(state: GameState): number | null {
  const next = CAMPUS_LEVELS[state.giant.campus];
  return next ? next.price * inf(state) : null;
}

/** Output bonus of the campus for staff, research and departments. */
export function campusBonus(state: GameState): number {
  return state.giant.campus > 0 ? CAMPUS_LEVELS[state.giant.campus - 1].bonus : 0;
}

export function ownChipRatio(state: GameState): number {
  return state.giant.chip.level > 0 ? chipRatio(state.giant.chip.level, state.giant.campus) : 0;
}

/** OS quality 0–10 from the OS level and the programmers' skill. */
export function osQuality(state: GameState): number {
  if (state.giant.os.level < 1) return 0;
  const progs = state.team.staff.filter((e) => e.role === 'programmer');
  const skill = progs.length ? progs.reduce((a, e) => a + e.skill, 0) / progs.length : 30;
  return clamp(3.5 + 1.1 * state.giant.os.level + skill / 40, 0, 10);
}

/** App ecosystem 0–10 from the installed base (the chicken-and-egg part). */
export function osEcosystem(state: GameState): number {
  const u = state.giant.os.installed;
  return (10 * u) / (u + OS_HALF_BASE);
}

/** Own OS score (GDD §15.2). */
export function osScore(state: GameState): number {
  return state.giant.os.level > 0 ? 0.5 * osQuality(state) + 0.5 * osEcosystem(state) : 0;
}

/** Rival valuation for takeovers. */
export function rivalValue(state: GameState, id: string): number {
  const r = state.rivals.find((x) => x.id === id);
  if (!r) return Infinity;
  return (r.brand * 2_000_000 + r.unitsLastYear * 60) * inf(state);
}

export function canAcquire(state: GameState, id: string, ownValuation: number): boolean {
  const r = state.rivals.find((x) => x.id === id);
  return !!r && state.phase >= 5 && !state.giant.acquired.includes(id) && r.brand < 30 && rivalValue(state, id) < 0.25 * ownValuation;
}

/** Side-product review: tier, brand, ecosystem, minus age (1.5 points/year). */
export function sideReview(state: GameState, p: SideProduct): number {
  const years = (state.day - p.launchDay) / (DAYS_PER_WEEK * 52);
  const eco = ecosystemComplete(state) ? 0.3 : 0;
  return clamp(5 + SIDE_TIER_BONUS[p.tier as Tier] + state.company.brand / 40 + eco - 1.5 * years, 0, 10);
}

/** All three side products on sale (launched within 3 years): phones get +5 %. */
export function ecosystemComplete(state: GameState): boolean {
  const s = state.giant.side;
  return (['watch', 'earbuds', 'tablet'] as SideKind[]).every((k) => s[k] && state.day - s[k]!.launchDay < 3 * 52 * DAYS_PER_WEEK);
}

export function sideUnitsWeek(state: GameState, kind: SideKind): number {
  const p = state.giant.side[kind];
  if (!p) return 0;
  const def = SIDE_PRODUCTS[kind];
  const r = sideReview(state, p);
  const priceF = Math.pow(1 / SIDE_PRICE[p.priceLevel as SidePrice], 1.4);
  return (state.company.fans * def.attach * Math.pow(r / 10, 2) * priceF) / 10;
}

export type GiantAction =
  | { type: 'buildCampus' }
  | { type: 'startChip' }
  | { type: 'startOs' }
  | { type: 'setLicensing'; what: 'chip' | 'os'; on: boolean }
  | { type: 'launchSide'; kind: SideKind; tier: Tier; price: SidePrice }
  | { type: 'acquire'; id: string };

export function applyGiantAction(state: GameState, action: GiantAction, ownValuation: number): SimEvent[] {
  const g = state.giant;
  const no = (reason: 'noCash' | 'notReady' | 'busy' = 'notReady'): SimEvent[] => [{ type: 'rejected', reason }];
  const pay = (amount: number) => {
    if (state.company.cash < amount) return false;
    state.company.cash -= amount;
    return true;
  };
  switch (action.type) {
    case 'buildCampus': {
      const cost = campusCost(state);
      if (cost === null || !state.phase5Ready) return no();
      if (!pay(cost)) return no('noCash');
      g.campus += 1;
      if (state.phase < 5) state.phase = 5;
      return [{ type: 'campusBuilt', level: g.campus }];
    }
    case 'startChip': {
      if (g.campus < 1) return no();
      if (g.chip.project) return no('busy');
      const c = chipProjectCost(g.chip.level);
      if (!pay(c.money * inf(state))) return no('noCash');
      g.chip.project = { progress: 0, need: c.points };
      return [{ type: 'projectStarted', what: 'chip' }];
    }
    case 'startOs': {
      if (g.campus < 1) return no();
      if (g.os.project) return no('busy');
      const c = osProjectCost(g.os.level);
      if (!pay(c.money * inf(state))) return no('noCash');
      g.os.project = { progress: 0, need: c.points };
      return [{ type: 'projectStarted', what: 'os' }];
    }
    case 'setLicensing':
      g[action.what].licensing = action.on;
      if (!action.on) g[action.what].licensees = [];
      return [];
    case 'launchSide': {
      const def = SIDE_PRODUCTS[action.kind];
      if (state.phase < 5 || yearOf(state.day) < def.year) return no();
      if (!pay(def.dev * inf(state) * (1 + 0.5 * ['lite', 'std', 'pro'].indexOf(action.tier)))) return no('noCash');
      const prev = g.side[action.kind];
      g.side[action.kind] = { tier: action.tier, priceLevel: action.price, launchDay: state.day, gen: (prev?.gen ?? 0) + 1, units: 0, revenue: 0 };
      return [{ type: 'sideLaunched', kind: action.kind }];
    }
    case 'acquire': {
      if (!canAcquire(state, action.id, ownValuation)) return no();
      const price = rivalValue(state, action.id) * 1.3;
      if (!pay(price)) return no('noCash');
      const r = state.rivals.find((x) => x.id === action.id)!;
      g.acquired.push(action.id);
      state.company.fans += r.unitsLastYear * 0.1;
      state.company.brand = clamp(state.company.brand + 3, 0, 100);
      addNews(state, { kind: 'acquired', rival: action.id });
      return [{ type: 'acquired', rival: action.id, price }];
    }
  }
}

/** Daily: department projects progress with the team's output. */
export function tickGiantDay(state: GameState): SimEvent[] {
  const g = state.giant;
  if (g.campus < 1) return [];
  const events: SimEvent[] = [];
  const rates = teamRates(state);
  const boost = 1 + campusBonus(state);
  if (g.chip.project) {
    g.chip.project.progress += rates.tech * 0.5 * boost;
    if (g.chip.project.progress >= g.chip.project.need) {
      g.chip.level += 1;
      g.chip.project = null;
      addNews(state, { kind: 'ownChip', value: g.chip.level });
      events.push({ type: 'projectDone', what: 'chip', level: g.chip.level });
    }
  }
  if (g.os.project) {
    g.os.project.progress += rates.software * 0.5 * boost;
    if (g.os.project.progress >= g.os.project.need) {
      g.os.level += 1;
      g.os.project = null;
      addNews(state, { kind: 'ownOs', value: g.os.level });
      events.push({ type: 'projectDone', what: 'os', level: g.os.level });
    }
  }
  return events;
}

/**
 * Weekly: installed base, licences, side-product sales, campus upkeep.
 * `ownOsUnits` = player units sold this week with the own OS. Returns the cash change.
 */
export function tickGiantWeek(state: GameState, ownOsUnits: number): number {
  const g = state.giant;
  const i = inf(state);
  let cash = 0;
  // Installed base of the own OS (licensees count half).
  const licensedUnits = g.os.licensees.reduce((a, id) => a + (state.rivals.find((r) => r.id === id)?.unitsLastYear ?? 0) / 52, 0);
  g.os.installed = g.os.installed * Math.exp(-1 / OS_BASE_LIFE_WEEKS) + ownOsUnits + licensedUnits * 0.5;
  // Licensees: the biggest rivals sign up when the tech is good enough.
  const big = state.rivals.filter((r) => !g.acquired.includes(r.id)).sort((a, b) => b.unitsLastYear - a.unitsLastYear);
  g.chip.licensees = g.chip.licensing && ownChipRatio(state) >= 1.05 ? big.slice(0, Math.min(3, 1 + Math.floor(g.chip.level / 3))).map((r) => r.id) : [];
  g.os.licensees = g.os.licensing && osScore(state) >= 7.5 ? big.slice(0, 2).map((r) => r.id) : [];
  const weekly = (ids: string[]) => ids.reduce((a, id) => a + (state.rivals.find((r) => r.id === id)?.unitsLastYear ?? 0) / 52, 0);
  const licence = weekly(g.chip.licensees) * CHIP_FEE * i + weekly(g.os.licensees) * OS_FEE * i;
  g.licenceWeek = licence;
  cash += licence;
  // Side products.
  for (const kind of ['watch', 'earbuds', 'tablet'] as SideKind[]) {
    const p = g.side[kind];
    if (!p) continue;
    const units = sideUnitsWeek(state, kind);
    const revenue = units * SIDE_PRODUCTS[kind].anchor * SIDE_PRICE[p.priceLevel as SidePrice] * i;
    p.units += units;
    p.revenue += revenue;
    state.stats.revenueTotal += revenue;
    state.week.revenue += revenue;
    cash += revenue * SIDE_MARGIN;
  }
  // Campus upkeep.
  if (g.campus > 0) cash -= CAMPUS_LEVELS.slice(0, g.campus).reduce((a, l) => a + l.price, 0) * CAMPUS_UPKEEP * i;
  return cash;
}
