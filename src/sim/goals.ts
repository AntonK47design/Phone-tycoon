// Goal evaluation (GDD §18.1).

import { GOALS, VISIBLE_GOALS, type GoalDef } from '../data/goals';
import type { SimEvent } from './events';
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
      if (goal.gate && !state.officeReady) {
        state.officeReady = true;
        events.push({ type: 'officeReady' });
      }
      changed = true;
    }
  }
  return events;
}
