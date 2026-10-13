// Offline progress (GDD §20.1): the calendar moves at most 4 weeks; the rest of the
// absence (capped at 8 h) becomes a 25 % work credit for research and development.

import type { SimEvent } from './events';
import { advanceDay } from './game';
import { tickResearch } from './research';
import type { GameState } from './state';
import { teamRates } from './team';
import { SECONDS_PER_DAY } from './time';

export const OFFLINE_CAP_SECONDS = 8 * 3600;
export const OFFLINE_MAX_DAYS = 28;
export const OFFLINE_CREDIT = 0.25;
/** Absences shorter than this are ignored. */
export const OFFLINE_MIN_SECONDS = 60;

export interface OfflineReport {
  seconds: number;
  days: number;
  cashDelta: number;
  unitsSold: number;
  researchDone: string[];
  devDone: boolean;
  ordersArrived: number;
  events: SimEvent[];
}

export function applyOffline(state: GameState, seconds: number): OfflineReport | null {
  if (!state.clockStarted || seconds < OFFLINE_MIN_SECONDS) return null;
  const capped = Math.min(seconds, OFFLINE_CAP_SECONDS);
  const cash0 = state.company.cash;
  const units0 = state.stats.unitsTotal;
  const days = Math.min(OFFLINE_MAX_DAYS, Math.floor(capped / SECONDS_PER_DAY));
  const events: SimEvent[] = [];
  for (let i = 0; i < days; i++) events.push(...advanceDay(state));

  // Work credit for the time the calendar did not cover.
  const creditDays = Math.max(0, (capped / SECONDS_PER_DAY) * OFFLINE_CREDIT - days);
  if (creditDays > 0) {
    events.push(...tickResearch(state, creditDays));
    const dev = state.dev;
    if (dev && !dev.done) {
      const rates = teamRates(state);
      for (const k of ['design', 'tech', 'software'] as const) {
        dev.progress[k] = Math.min(dev.required[k], dev.progress[k] + rates[k] * creditDays);
      }
      if (dev.progress.design >= dev.required.design && dev.progress.tech >= dev.required.tech && dev.progress.software >= dev.required.software) {
        dev.done = true;
        events.push({ type: 'devDone' });
      }
    }
  }
  state.lastOffline = { cash: Math.max(0, state.company.cash - cash0), claimed: false };
  return {
    seconds: capped,
    days,
    cashDelta: state.company.cash - cash0,
    unitsSold: state.stats.unitsTotal - units0,
    researchDone: events.flatMap((e) => (e.type === 'researchDone' ? [e.id] : [])),
    devDone: events.some((e) => e.type === 'devDone'),
    ordersArrived: events.filter((e) => e.type === 'orderArrived').length,
    events,
  };
}
