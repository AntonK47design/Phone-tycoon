// Events emitted by the simulation. Render/UI/audio react to them (juice) but never
// change the state in response except through actions.

import type { GoalReward } from '../data/goals';
import type { ReviewResult } from './state';

export type SimEvent =
  | {
      type: 'launched';
      productId: number;
      preorderUnits: number;
      preorderRevenue: number;
      review: ReviewResult;
      brandDelta: number;
    }
  | { type: 'goalCompleted'; goalId: string; reward: GoalReward }
  | { type: 'colorUnlocked'; colorId: string }
  | { type: 'devStarted'; days: number; cost: number }
  | { type: 'devDone' }
  | { type: 'sales'; units: number; revenue: number; profit: number }
  | { type: 'weekEnd'; week: number }
  | { type: 'productRetired'; productId: number }
  | { type: 'officeReady' }
  | { type: 'rejected'; reason: 'noCash' | 'busy' | 'notReady' };
