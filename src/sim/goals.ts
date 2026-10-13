// Goal evaluation (GDD §18.1).

import { GOALS, VISIBLE_GOALS, type GoalDef } from '../data/goals';
import type { SimEvent } from './events';
import { marketShare, valuation } from './game';
import { yearOf } from './time';
import type { GameState } from './state';

export function goalProgress(state: GameState, goal: GoalDef): number {
  switch (goal.kind) {
    case 'launches':
      return state.stats.launches;
    case 'cash':
      return state.company.cash;
    case 'review':
      return state.stats.bestReview;
    case 'unitsTotal':
      return state.stats.unitsTotal;
    case 'fans':
      return state.company.fans;
    case 'phase':
      return state.phase;
    case 'research':
      return state.research.done.length;
    case 'hypeLaunch':
      return state.stats.bestLaunchHype;
    case 'revenueTotal':
      return state.stats.revenueTotal;
    case 'valuation':
      return valuation(state);
    case 'brand':
      return state.company.brand;
    case 'staff':
      return state.team.staff.length;
    case 'officeLevel':
      return state.team.office;
    case 'trainings':
      return state.stats.trainings;
    case 'produced':
      return state.factory.produced;
    case 'lineLevel':
      return state.factory.lines.reduce((a, l) => Math.max(a, l.level), 0);
    case 'lines':
      return state.factory.lines.length;
    case 'regions':
      return state.regions.entered.length;
    case 'stores':
      return Object.values(state.regions.stores).reduce((a, b) => a + b, 0);
    case 'contracts':
      return state.contracts.done;
    case 'campus':
      return state.giant.campus;
    case 'chipLevel':
      return state.giant.chip.level;
    case 'osLevel':
      return state.giant.os.level;
    case 'sideProducts':
      return Object.values(state.giant.side).filter(Boolean).length;
    case 'acquired':
      return state.giant.acquired.length;
    case 'endgame': {
      const share = marketShare(state) / 0.2;
      const big = yearOf(state.day) >= 2045 ? valuation(state) / 100_000_000_000 : 0;
      return Math.min(1, Math.max(share, big));
    }
  }
}

export function visibleGoals(state: GameState): GoalDef[] {
  return GOALS.filter((g) => !state.completedGoals.includes(g.id)).slice(0, VISIBLE_GOALS);
}

/** Completes every visible goal whose condition is met. Returns emitted events. */
export function checkGoals(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const goal of visibleGoals(state)) {
      if (goalProgress(state, goal) < goal.target) continue;
      if (goal.requires?.some((id) => !state.completedGoals.includes(id))) continue;
      state.completedGoals.push(goal.id);
      if (goal.reward.cash) state.company.cash += goal.reward.cash;
      events.push({ type: 'goalCompleted', goalId: goal.id, reward: goal.reward });
      const color = goal.reward.unlockColor;
      if (color && !state.unlockedColors.includes(color)) {
        state.unlockedColors.push(color);
        events.push({ type: 'colorUnlocked', colorId: color });
      }
      if (goal.gate === 'office' && !state.officeReady) {
        state.officeReady = true;
        events.push({ type: 'officeReady' });
      }
      if (goal.gate === 'phase3' && !state.phase3Ready) {
        state.phase3Ready = true;
        events.push({ type: 'phase3Ready' });
      }
      if (goal.gate === 'phase4' && !state.phase4Ready) {
        state.phase4Ready = true;
        events.push({ type: 'phase4Ready' });
      }
      if (goal.gate === 'phase5' && !state.phase5Ready) {
        state.phase5Ready = true;
        events.push({ type: 'phase5Ready' });
      }
      if (goal.gate === 'phase6' && !state.phase6Ready) {
        state.phase6Ready = true;
        if (state.phase < 6) state.phase = 6;
        events.push({ type: 'phase6Ready' });
      }
      changed = true;
    }
  }
  return events;
}
