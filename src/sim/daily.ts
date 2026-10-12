// Daily retention hooks (GDD §20.3–20.4): a friendly 7-day calendar and three mini
// orders per real-world day. The real date comes in through actions, so the sim stays
// deterministic: the same date and seed always produce the same orders.

import { inflation } from '../data/eras';
import type { SimEvent } from './events';
import { createRng } from './rng';
import type { DailyKind, DailyOrder, DailyState, GameState } from './state';
import { yearOf } from './time';

export const CALENDAR_BASE = [500, 700, 900, 1200, 1500, 2000, 4000];
const CALENDAR_MULT = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5];
export const CALENDAR_COSMETIC = 'aurora';
export const DAILY_COUNT = 3;

export function newDaily(): DailyState {
  return { date: null, orders: [], calendarStep: 0, cycles: 0, lastClaim: null };
}

function avgWeeklyRevenue(state: GameState): number {
  const r = state.history.revenue.slice(-4);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
}

/** Calendar reward for the next claim: max(base, 0.5 × average weekly revenue), scaled by the day. */
export function calendarReward(state: GameState): { cash: number; cosmetic?: string } {
  const step = state.daily.calendarStep;
  const inf = inflation(Math.floor(yearOf(state.day)));
  const cash = Math.round(Math.max(CALENDAR_BASE[step] * inf, 0.5 * avgWeeklyRevenue(state) * CALENDAR_MULT[step]));
  const cosmetic = step === 6 && !state.cosmetics.includes(CALENDAR_COSMETIC) ? CALENDAR_COSMETIC : undefined;
  return { cash, cosmetic };
}

export function calendarClaimable(state: GameState, date: string): boolean {
  return state.clockStarted && state.daily.lastClaim !== date;
}

function hashDate(date: string): number {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Rounds to 1–2 significant digits so targets read nicely ("2,500 units"). */
function nice(n: number): number {
  if (n < 10) return Math.max(1, Math.round(n));
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.ceil(n / mag / 5) * 5 * mag;
}

export function dailyCounter(state: GameState, o: DailyOrder): number {
  switch (o.kind) {
    case 'sell':
      return state.stats.unitsTotal - o.base;
    case 'revenue':
      return state.stats.revenueTotal - o.base;
    case 'launch':
      return state.products.filter((p) => p.launchDay >= o.day && p.id > o.base && p.review.score >= o.target).length;
    case 'research':
      return state.research.done.length - o.base;
    case 'hire':
      return state.stats.hires - o.base;
    case 'train':
      return state.stats.trainings - o.base;
    case 'reorder':
      return state.stats.reorders - o.base;
  }
}

/** Progress 0–1 of a mini order. */
export function dailyProgress(state: GameState, o: DailyOrder): number {
  if (o.done) return 1;
  const goal = o.kind === 'launch' ? 1 : o.target;
  return Math.min(1, dailyCounter(state, o) / goal);
}

function makeOrder(state: GameState, kind: DailyKind, cash: number): DailyOrder {
  const last = <T>(a: T[]) => a[a.length - 1];
  const o: DailyOrder = { kind, target: 1, base: 0, day: state.day, reward: { cash }, done: false, claimed: false };
  switch (kind) {
    case 'sell':
      o.base = state.stats.unitsTotal;
      o.target = nice(Math.max(40, (last(state.history.playerUnits) ?? 0) * 4));
      break;
    case 'revenue':
      o.base = state.stats.revenueTotal;
      o.target = nice(Math.max(5_000, (last(state.history.revenue) ?? 0) * 4));
      break;
    case 'launch':
      o.base = state.nextProductId - 1;
      o.target = Math.min(8.5, Math.max(6, Math.floor((state.stats.bestReview - 0.3) * 2) / 2));
      o.reward = { hype: 15, cash: Math.round(cash / 2) };
      break;
    case 'research':
      o.base = state.research.done.length;
      break;
    case 'hire':
      o.base = state.stats.hires;
      break;
    case 'train':
      o.base = state.stats.trainings;
      break;
    case 'reorder':
      o.base = state.stats.reorders;
      break;
  }
  return o;
}

/** Called with today's real date; creates fresh orders once per day. */
export function dailySync(state: GameState, date: string): SimEvent[] {
  if (state.daily.date === date || !state.clockStarted) return [];
  const rng = createRng(hashDate(date) ^ state.seed);
  const pool: DailyKind[] = ['sell', 'revenue', 'launch'];
  if (state.phase >= 2) {
    pool.push('research', 'reorder');
    if (state.team.office >= 1) pool.push('hire');
    if (state.team.staff.length > 0) pool.push('train');
  }
  const inf = inflation(Math.floor(yearOf(state.day)));
  const cash = Math.round(Math.max(1500 * inf, 0.3 * avgWeeklyRevenue(state)));
  const orders: DailyOrder[] = [];
  while (orders.length < DAILY_COUNT && pool.length) {
    const kind = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    orders.push(makeOrder(state, kind, cash));
  }
  state.daily.date = date;
  state.daily.orders = orders;
  return [];
}

/** Marks finished orders (emits once per order). */
export function checkDaily(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  state.daily.orders.forEach((o, index) => {
    if (o.done) return;
    if (dailyProgress(state, o) >= 1) {
      o.done = true;
      events.push({ type: 'dailyDone', index });
    }
  });
  return events;
}

export function claimDaily(state: GameState, index: number): SimEvent[] {
  const o = state.daily.orders[index];
  if (!o || !o.done || o.claimed) return [{ type: 'rejected', reason: 'notReady' }];
  o.claimed = true;
  const reward = { ...o.reward };
  if (reward.hype) {
    const target = [...state.products].reverse().find((p) => p.active);
    if (target) target.hype = Math.min(100, target.hype + reward.hype);
    else delete reward.hype;
  }
  if (reward.cash) state.company.cash += reward.cash;
  return [{ type: 'dailyClaimed', index, reward }];
}

export function claimCalendar(state: GameState, date: string): SimEvent[] {
  if (!calendarClaimable(state, date)) return [{ type: 'rejected', reason: 'busy' }];
  const step = state.daily.calendarStep;
  const reward = calendarReward(state);
  state.company.cash += reward.cash;
  if (reward.cosmetic) state.cosmetics.push(reward.cosmetic);
  state.daily.lastClaim = date;
  state.daily.calendarStep = (step + 1) % 7;
  if (state.daily.calendarStep === 0) state.daily.cycles += 1;
  return [{ type: 'calendarClaimed', step, cash: reward.cash, cosmetic: reward.cosmetic }];
}
