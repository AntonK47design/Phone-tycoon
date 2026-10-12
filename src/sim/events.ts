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
      /** Factory line that now builds this phone. */
      lineId?: number | null;
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
  | { type: 'repaid'; amount: number }
  | { type: 'hired'; id: number; role: string }
  | { type: 'fired'; id: number }
  | { type: 'trainingStarted'; id: number }
  | { type: 'trainingDone'; id: number; skill: number }
  | { type: 'staffQuit'; id: number; name: string }
  | { type: 'officeUpgraded'; level: number }
  | { type: 'labBuilt'; level: number }
  | { type: 'studioBuilt'; level: number }
  | { type: 'bonusPaid' }
  | { type: 'factoryBuilt' }
  | { type: 'factoryGrown'; size: number }
  | { type: 'lineAdded'; id: number }
  | { type: 'lineUpgraded'; id: number; level: number }
  | { type: 'warehouseUpgraded'; level: number }
  | { type: 'produced'; units: number; scrapped: number }
  | { type: 'phase4Ready' }
  | { type: 'rivalLaunch'; rival: string; name: string; review: number }
  | { type: 'rivalPriceCut'; rival: string; segment: string }
  | { type: 'eventStarted'; id: string; target?: string }
  | { type: 'eventEnded'; id: string }
  | { type: 'eventChoice'; id: string }
  | { type: 'regionEntered'; region: string }
  | { type: 'storeOpened'; region: string }
  | { type: 'contractOffered'; id: number }
  | { type: 'contractDone'; id: number; payout: number }
  | { type: 'contractFailed'; id: number }
  | { type: 'campusBuilt'; level: number }
  | { type: 'projectStarted'; what: 'chip' | 'os' }
  | { type: 'projectDone'; what: 'chip' | 'os'; level: number }
  | { type: 'sideLaunched'; kind: string }
  | { type: 'acquired'; rival: string; price: number }
  | { type: 'phase5Ready' }
  | { type: 'phase6Ready' }
  | { type: 'achievement'; id: string }
  | { type: 'record'; kind: string }
  | { type: 'dailyDone'; index: number }
  | { type: 'dailyClaimed'; index: number; reward: { cash?: number; hype?: number } }
  | { type: 'calendarClaimed'; step: number; cash: number; cosmetic?: string }
  | { type: 'rejected'; reason: 'noCash' | 'busy' | 'notReady' | 'noSeats' };
