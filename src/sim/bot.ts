// Balancing bot (GDD §24.3). Plays headless through the public action API.

import { DISPLAY_SIZES, SHAPES } from '../data/design';
import { forecast, newGame, applyAction, advanceDay } from './game';
import type { GameState, PhoneDesign } from './state';
import { SECONDS_PER_DAY, calendar } from './time';

export type BotProfile = 'average' | 'optimizer' | 'weak';

export interface BotSample {
  minute: number;
  date: string;
  phase: number;
  cash: number;
  launches: number;
  avgReview: number;
  unitsPerWeek: number;
  brand: number;
  fans: number;
}

export interface BotResult {
  samples: BotSample[];
  firstLaunchSec: number;
  officeReadyMin: number | null;
  final: GameState;
}

/** Speed mix: 40 % 1x, 30 % 2x, 30 % 4x, cycled in 10-minute blocks. */
function speedAt(sec: number, profile: BotProfile): number {
  if (profile === 'optimizer') return 4;
  const t = (sec / 60) % 10;
  return t < 4 ? 1 : t < 7 ? 2 : 4;
}

function bestDesign(state: GameState, profile: BotProfile, seedPick: number): Partial<PhoneDesign> {
  const colors = state.unlockedColors;
  if (profile === 'weak') {
    return {
      colorId: colors[seedPick % colors.length],
      shapeId: SHAPES[seedPick % SHAPES.length].id,
      displaySize: DISPLAY_SIZES[(seedPick >> 2) % DISPLAY_SIZES.length],
    };
  }
  let best: Partial<PhoneDesign> = {};
  let bestScore = -Infinity;
  for (const colorId of colors) {
    for (const s of SHAPES) {
      for (const displaySize of DISPLAY_SIZES) {
        const d = { ...state.draft, colorId, shapeId: s.id, displaySize };
        const f = forecast(state, d);
        // Average bot cares about review; optimizer about weekly profit.
        const score = profile === 'optimizer' ? f.weeklyUnits * f.margin : f.review;
        if (score > bestScore) {
          bestScore = score;
          best = { colorId, shapeId: s.id, displaySize };
        }
      }
    }
  }
  return best;
}

export function runBot(opts: { minutes: number; seed: number; profile?: BotProfile; sampleEveryMin?: number }): BotResult {
  const profile = opts.profile ?? 'average';
  const state = newGame(opts.seed);
  const samples: BotSample[] = [];
  let officeReadyMin: number | null = null;
  let pick = opts.seed;

  // First minute: three taps in the tutorial (~8 s each), then launch.
  const firstLaunchSec = 33;
  applyAction(state, { type: 'setDraft', patch: bestDesign(state, profile, pick++) });
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
      if (state.officeReady && officeReadyMin === null) officeReadyMin = sec / 60;
    }
    if (sec >= nextSample) {
      samples.push(sample(state, sec / 60));
      nextSample += sampleEvery;
    }
  }
  return { samples, firstLaunchSec, officeReadyMin, final: state };
}

function botDecide(state: GameState, profile: BotProfile, nextPick: () => number): void {
  if (state.dev?.done) {
    applyAction(state, { type: 'launch' });
    return;
  }
  if (state.dev) return;
  const latest = state.products[state.products.length - 1];
  const age = latest ? (state.day - latest.launchDay) / 7 : Infinity;
  const interval = profile === 'optimizer' ? 6 : profile === 'weak' ? 16 : 10;
  if (age < interval) return;
  applyAction(state, { type: 'setDraft', patch: bestDesign(state, profile, nextPick()) });
  applyAction(state, { type: 'startDev' });
}

function sample(state: GameState, minute: number): BotSample {
  const cal = calendar(state.day);
  const reviews = state.products.map((p) => p.review.score);
  return {
    minute: Math.round(minute * 10) / 10,
    date: `W${cal.week} ${cal.year}`,
    phase: state.officeReady ? 2 : state.phase,
    cash: Math.round(state.company.cash),
    launches: state.stats.launches,
    avgReview: reviews.length ? Math.round((reviews.reduce((a, b) => a + b, 0) / reviews.length) * 10) / 10 : 0,
    unitsPerWeek: state.products.reduce((a, p) => a + (p.active ? p.lastWeekUnits : 0), 0),
    brand: Math.round(state.company.brand),
    fans: Math.round(state.company.fans),
  };
}
