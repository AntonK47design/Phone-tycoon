// Phase-1 goal chain (GDD §18.1). Conditions are evaluated in sim/goals.ts.

export type GoalKind = 'launches' | 'cash' | 'review' | 'unitsTotal' | 'fans';

export interface GoalReward {
  cash?: number;
  unlockColor?: string;
}

export interface GoalDef {
  id: string;
  kind: GoalKind;
  target: number;
  reward: GoalReward;
  /** Goal that marks the Phase-2 gate. */
  gate?: boolean;
  /** Goals that must be completed before this one can complete. */
  requires?: string[];
}

export const GOALS: GoalDef[] = [
  { id: 'firstLaunch', kind: 'launches', target: 1, reward: { unlockColor: 'midnight' } },
  { id: 'earn10k', kind: 'cash', target: 10_000, reward: { unlockColor: 'coral' } },
  { id: 'secondLaunch', kind: 'launches', target: 2, reward: { cash: 2_500 } },
  { id: 'sell500', kind: 'unitsTotal', target: 500, reward: { unlockColor: 'mint' } },
  { id: 'office', kind: 'cash', target: 25_000, reward: {}, gate: true, requires: ['secondLaunch'] },
  { id: 'review8', kind: 'review', target: 8, reward: { unlockColor: 'gold' } },
  { id: 'fans100', kind: 'fans', target: 100, reward: { cash: 5_000 } },
];

/** How many goals are visible at once. */
export const VISIBLE_GOALS = 3;
