// Event director (GDD §13): a weekly, seeded roll for market events with cooldowns.
// At most one "big" event at a time. Some events ask the player to choose.

import { DAYS_PER_WEEK, inflation } from '../data/eras';
import { researchById } from '../data/research';
import { addNews } from './competitors';
import type { SimEvent } from './events';
import { createRng, type Rng } from './rng';
import { researchCost } from './research';
import { clamp } from './scoring/score';
import type { ActiveEvent, EventId, EventState, GameState } from './state';
import { yearOf } from './time';

export function newEvents(): EventState {
  return { active: [], cooldown: {}, pending: null, tradeFair: false };
}

/** Events that change the whole market; only one of them runs at a time. */
const BIG: EventId[] = ['chipShortage', 'recession', 'cameraHype', 'tariff'];
const COOLDOWN_WEEKS = 52;
/** Unanswered event cards take their default option after this many weeks. */
const CHOICE_WEEKS = 4;

export function isActive(state: GameState, id: EventId, target?: string): boolean {
  return state.events.active.some((e) => e.id === id && state.day < e.until && (target === undefined || e.target === target));
}

/** Market size multiplier (recession: −15 %). */
export function marketMultiplier(state: GameState): number {
  return isActive(state, 'recession') ? 0.85 : 1;
}

/** Price elasticity multiplier (recession: customers count every dollar). */
export function elasticityMultiplier(state: GameState): number {
  return isActive(state, 'recession') ? 1.25 : 1;
}

/** Production cost multiplier (chip shortage without stockpiling: +8 %). */
export function productionCostMultiplier(state: GameState): number {
  return isActive(state, 'chipShortage', 'wait') ? 1.08 : 1;
}

/** Factory capacity multiplier (chip shortage without stockpiling: −30 %). */
export function capacityMultiplier(state: GameState): number {
  return isActive(state, 'chipShortage', 'wait') ? 0.7 : 1;
}

export function cameraHype(state: GameState): boolean {
  return isActive(state, 'cameraHype');
}

export function tariffRegion(state: GameState): string | null {
  return state.events.active.find((e) => e.id === 'tariff' && state.day < e.until)?.target ?? null;
}

function start(state: GameState, id: EventId, weeks: number, target?: string): ActiveEvent {
  const e: ActiveEvent = { id, start: state.day, until: state.day + Math.round(weeks) * DAYS_PER_WEEK, target };
  state.events.active.push(e);
  state.events.cooldown[id] = state.day + COOLDOWN_WEEKS * DAYS_PER_WEEK;
  addNews(state, { kind: `event.${id}`, rival: target });
  return e;
}

function revenue52(state: GameState): number {
  return state.history.revenue.reduce((a, b) => a + b, 0);
}

/** Weekly roll. */
export function tickDirector(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const ev = state.events;
  const year = yearOf(state.day);
  // Expire finished events.
  for (const e of [...ev.active]) {
    if (state.day >= e.until) {
      ev.active = ev.active.filter((x) => x !== e);
      events.push({ type: 'eventEnded', id: e.id });
    }
  }
  if (ev.tradeFair && (ev.cooldown.tradeFairEnd ?? 0) <= state.day) ev.tradeFair = false;
  // Unanswered cards take their default.
  if (ev.pending && state.day >= ev.pending.deadline) events.push(...choose(state, ev.pending.options[ev.pending.options.length - 1]));
  if (!state.clockStarted || state.stats.launches < 2) return events;

  const rng = createRng(state.rng);
  const ready = (id: EventId) => (ev.cooldown[id] ?? -1) <= state.day && !ev.active.some((a) => a.id === id);
  const bigRunning = ev.active.some((a) => BIG.includes(a.id));
  const roll = (p: number) => rng.next() < p;
  const fire = (id: EventId, target?: string): void => {
    events.push({ type: 'eventStarted', id, target });
  };

  if (!bigRunning && !ev.pending) {
    if (year >= 2009 && ready('chipShortage') && roll(0.004)) {
      // Choice: stockpile chips now (pay) or wait it out (costs + capacity).
      const amount = Math.round(Math.max(20_000 * inflation(Math.floor(year)), 0.04 * revenue52(state)));
      ev.pending = { id: 'chipShortage', options: ['stockpile', 'wait'], deadline: state.day + CHOICE_WEEKS * DAYS_PER_WEEK, amount };
      ev.cooldown.chipShortage = state.day + COOLDOWN_WEEKS * DAYS_PER_WEEK;
      fire('chipShortage');
    } else if (year >= 2012 && ready('cameraHype') && roll(0.005)) {
      start(state, 'cameraHype', 26);
      fire('cameraHype');
    } else if (year >= 2008 && ready('recession') && roll(0.002)) {
      start(state, 'recession', rng.range(30, 52));
      fire('recession');
    } else if (state.phase >= 4 && ready('tariff') && roll(0.002)) {
      const foreign = state.regions.entered.filter((r) => r !== 'home');
      if (foreign.length) {
        const region = rng.pick(foreign);
        start(state, 'tariff', 26, region);
        fire('tariff', region);
      }
    }
  }
  // Smaller events.
  if (ready('rivalScandal') && roll(0.003)) {
    const rival = rng.pick(state.rivals);
    rival.scandalUntil = state.day + 8 * DAYS_PER_WEEK;
    start(state, 'rivalScandal', 8, rival.id);
    state.company.fans *= 1.05;
    fire('rivalScandal', rival.id);
  }
  if (state.company.brand > 30 && !ev.tradeFair && ready('tradeFair') && roll(0.003)) {
    ev.tradeFair = true;
    ev.cooldown.tradeFair = state.day + 26 * DAYS_PER_WEEK;
    ev.cooldown.tradeFairEnd = state.day + 4 * DAYS_PER_WEEK;
    addNews(state, { kind: 'event.tradeFair' });
    fire('tradeFair');
  }
  if (state.phase >= 2 && state.team.office > 0 && ready('starApplicant') && roll(0.0025)) {
    starApplicant(state, rng);
    ev.cooldown.starApplicant = state.day + 13 * DAYS_PER_WEEK;
    fire('starApplicant');
  }
  const cur = state.research.current;
  if (cur && ready('breakthrough') && roll(0.005)) {
    const need = researchCost(researchById(cur.id)!, year).rp;
    cur.progress += (need - cur.progress) * 0.5;
    ev.cooldown.breakthrough = state.day + 13 * DAYS_PER_WEEK;
    addNews(state, { kind: 'event.breakthrough' });
    fire('breakthrough');
  }
  // Own recall: scrap above 5 % slips through as faulty phones.
  const worst = state.products.filter((p) => p.active && (p.defectRate ?? 0) > 0.05).sort((a, b) => (b.defectRate ?? 0) - (a.defectRate ?? 0))[0];
  if (worst && !ev.pending && ready('recall') && roll(((worst.defectRate ?? 0) - 0.05) * 2)) {
    const amount = Math.round(Math.max(30_000 * inflation(Math.floor(year)), worst.unitsSold * worst.unitCost * 0.03));
    ev.pending = { id: 'recall', options: ['recall', 'ignore'], deadline: state.day + 2 * DAYS_PER_WEEK, target: String(worst.id), amount };
    ev.cooldown.recall = state.day + 26 * DAYS_PER_WEEK;
    fire('recall', String(worst.id));
  }
  state.rng = rng.state;
  return events;
}

function starApplicant(state: GameState, rng: Rng): void {
  const pool = state.team.applicants;
  if (!pool.length) return;
  const star = { ...pool[0], id: state.team.nextId++, skill: Math.round(rng.range(70, 86)), trait: 'perfectionist' as const, look: rng.int(0, 9999) };
  state.team.applicants = [star, ...pool.slice(0, 3)];
  // The star waits two weeks: the pool isn't refreshed before then.
  state.team.poolDay = state.day + 7;
  addNews(state, { kind: 'event.starApplicant', text: `${star.first} ${star.last}` });
}

/** Player (or the default after the deadline) answers an event card. */
export function choose(state: GameState, option: string): SimEvent[] {
  const p = state.events.pending;
  if (!p || !p.options.includes(option)) return [{ type: 'rejected', reason: 'notReady' }];
  const amount = p.amount ?? 0;
  if (p.id === 'chipShortage') {
    if (option === 'stockpile') {
      if (state.company.cash < amount) return [{ type: 'rejected', reason: 'noCash' }];
      state.company.cash -= amount;
      start(state, 'chipShortage', 16, 'stockpile');
    } else start(state, 'chipShortage', 16, 'wait');
  } else if (p.id === 'recall') {
    const product = state.products.find((x) => String(x.id) === p.target);
    if (option === 'recall') {
      if (state.company.cash < amount) return [{ type: 'rejected', reason: 'noCash' }];
      state.company.cash -= amount;
      if (product) product.defectRate = 0.01;
      addNews(state, { kind: 'event.recallDone', text: product?.design.name });
    } else {
      state.company.brand = clamp(state.company.brand - 15, 0, 100);
      addNews(state, { kind: 'event.recallIgnored', text: product?.design.name });
    }
  }
  state.events.pending = null;
  return [{ type: 'eventChoice', id: p.id }];
}
