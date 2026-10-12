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
      hype: number;
      /** Extra launch spend (marketing + presentation + first batch). */
      spend: number;
    }
  | { type: 'goalCompleted'; goalId: string; reward: GoalReward }
  | { type: 'colorUnlocked'; colorId: string }
  | { type: 'devStarted'; days: number; cost: number }
  | { type: 'devDone' }
  | { type: 'sales'; units: number; revenue: number; profit: number }
  | { type: 'weekEnd'; week: number }
  | { type: 'productRetired'; productId: number }
  | { type: 'officeReady' }
  | { type: 'officeRented' }
  | { type: 'phase3Ready' }
  | { type: 'researchStarted'; id: string }
  | { type: 'researchDone'; id: string }
  | { type: 'orderPlaced'; productId: number; units: number; cost: number; requested?: number }
  | { type: 'orderArrived'; productId: number; units: number }
  | { type: 'soldOut'; productId: number }
  | { type: 'loan'; amount: number }
  | { type: 'hired'; id: number; role: string }
  | { type: 'fired'; id: number }
  | { type: 'trainingStarted'; id: number }
  | { type: 'trainingDone'; id: number; skill: number }
  | { type: 'staffQuit'; id: number; name: string }
  | { type: 'officeUpgraded'; level: number }
  | { type: 'labBuilt'; level: number }
  | { type: 'studioBuilt'; level: number }
  | { type: 'bonusPaid' }
  | { type: 'dailyDone'; index: number }
  | { type: 'dailyClaimed'; index: number; reward: { cash?: number; hype?: number } }
  | { type: 'calendarClaimed'; step: number; cash: number; cosmetic?: string }
  | { type: 'rejected'; reason: 'noCash' | 'busy' | 'notReady' | 'noSeats' };
