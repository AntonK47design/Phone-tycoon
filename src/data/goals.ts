// Goal chain for Phases 1–4 (GDD §18.1). Conditions are evaluated in sim/goals.ts.

export type GoalKind =
  | 'launches'
  | 'cash'
  | 'review'
  | 'unitsTotal'
  | 'fans'
  | 'phase'
  | 'research'
  | 'hypeLaunch'
  | 'revenueTotal'
  | 'valuation'
  | 'brand'
  | 'staff'
  | 'officeLevel'
  | 'trainings'
  | 'produced'
  | 'lineLevel'
  | 'lines'
  | 'regions'
  | 'stores'
  | 'contracts';

export interface GoalReward {
  cash?: number;
  unlockColor?: string;
}

export interface GoalDef {
  id: string;
  kind: GoalKind;
  target: number;
  reward: GoalReward;
  /** Goal that opens a phase gate. */
  gate?: 'office' | 'phase3' | 'phase4';
  /** Goals that must be completed before this one can complete. */
  requires?: string[];
}

export const GOALS: GoalDef[] = [
  // Phase 1 – garage.
  { id: 'firstLaunch', kind: 'launches', target: 1, reward: { unlockColor: 'midnight' } },
  { id: 'earn10k', kind: 'cash', target: 10_000, reward: { unlockColor: 'coral' } },
  { id: 'secondLaunch', kind: 'launches', target: 2, reward: { cash: 2_500 } },
  { id: 'sell500', kind: 'unitsTotal', target: 500, reward: { unlockColor: 'mint' } },
  { id: 'office', kind: 'cash', target: 25_000, reward: {}, gate: 'office', requires: ['secondLaunch'] },
  // Phase 2 – startup office.
  { id: 'rentOffice', kind: 'phase', target: 2, reward: { cash: 5_000 } },
  { id: 'firstHire', kind: 'staff', target: 1, reward: { cash: 4_000 } },
  { id: 'firstResearch', kind: 'research', target: 1, reward: { unlockColor: 'gold' } },
  { id: 'team4', kind: 'staff', target: 4, reward: { cash: 12_000 } },
  { id: 'hypeLaunch', kind: 'hypeLaunch', target: 20, reward: { cash: 10_000 } },
  { id: 'review8', kind: 'review', target: 8, reward: { cash: 15_000 } },
  { id: 'research5', kind: 'research', target: 5, reward: { cash: 20_000 } },
  { id: 'sell5k', kind: 'unitsTotal', target: 5_000, reward: { cash: 25_000 } },
  { id: 'fans500', kind: 'fans', target: 500, reward: { cash: 20_000 } },
  { id: 'train1', kind: 'trainings', target: 1, reward: { cash: 15_000 } },
  { id: 'office2', kind: 'officeLevel', target: 2, reward: { cash: 40_000 } },
  { id: 'revenue1m', kind: 'revenueTotal', target: 1_000_000, reward: { cash: 50_000 } },
  { id: 'brand35', kind: 'brand', target: 35, reward: {} },
  { id: 'valuation10m', kind: 'valuation', target: 10_000_000, reward: {}, gate: 'phase3', requires: ['brand35'] },
  // Phase 3 – own factory.
  { id: 'buildFactory', kind: 'phase', target: 3, reward: { cash: 100_000 } },
  { id: 'produce50k', kind: 'produced', target: 50_000, reward: { cash: 250_000 } },
  { id: 'lineLevel3', kind: 'lineLevel', target: 3, reward: { cash: 200_000 } },
  { id: 'lines3', kind: 'lines', target: 3, reward: { cash: 400_000 } },
  { id: 'revenue100m', kind: 'revenueTotal', target: 100_000_000, reward: { cash: 1_000_000 } },
  { id: 'valuation100m', kind: 'valuation', target: 100_000_000, reward: { cash: 2_000_000 } },
  { id: 'revenue400m', kind: 'revenueTotal', target: 400_000_000, reward: {}, gate: 'phase4', requires: ['lines3'] },
  // Phase 4 – expansion.
  { id: 'region2', kind: 'regions', target: 2, reward: { cash: 1_000_000 } },
  { id: 'store1', kind: 'stores', target: 1, reward: { cash: 500_000 } },
  { id: 'contracts3', kind: 'contracts', target: 3, reward: { cash: 2_000_000 } },
  { id: 'regions5', kind: 'regions', target: 5, reward: { cash: 5_000_000 } },
  { id: 'stores10', kind: 'stores', target: 10, reward: { cash: 10_000_000 } },
  { id: 'valuation1b', kind: 'valuation', target: 1_000_000_000, reward: {} },
];

/** How many goals are visible at once. */
export const VISIBLE_GOALS = 3;
