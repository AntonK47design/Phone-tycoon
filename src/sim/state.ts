// Serializable game state. Plain JSON only (no classes, Maps or Dates).

import type { Segment } from '../data/market';

export const SAVE_VERSION = 1;

export interface PhoneDesign {
  name: string;
  segment: Segment;
  price: number;
  /** null = unpainted prototype. */
  colorId: string | null;
  shapeId: string;
  displaySize: number;
  materialId: string;
  finishId: string;
  osId: string;
  /** Year of the parts kit used (tech values are frozen at this year). */
  kitYear: number;
}

export interface ReviewCard {
  outletId: string;
  score: number;
  /** i18n key suffix of the quote, e.g. "good.design". */
  quote: string;
}

export interface ReviewResult {
  score: number;
  design: number;
  tech: number;
  /** Overall rating P before quality/value adjustments. */
  p: number;
  value: number;
  cards: ReviewCard[];
}

export interface Product {
  id: number;
  design: PhoneDesign;
  launchDay: number;
  review: ReviewResult;
  unitCost: number;
  unitsSold: number;
  revenue: number;
  profit: number;
  /** Units sold in the last completed week. */
  lastWeekUnits: number;
  /** Units sold in the current (running) week. */
  weekUnits: number;
  /** Fractional units carried between days (determinism without rounding drift). */
  carry: number;
  active: boolean;
  /** Was the demand capped by capacity during the last week? */
  capped: boolean;
}

export interface Development {
  design: PhoneDesign;
  required: { design: number; tech: number; software: number };
  progress: { design: number; tech: number; software: number };
  done: boolean;
}

export type TutorialStep = 'color' | 'shape' | 'display' | 'launch' | 'done';

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  /** Days since 1 Jan 2007 (364-day years). */
  day: number;
  /** Has the clock been started (after the first launch)? */
  clockStarted: boolean;
  company: {
    name: string;
    cash: number;
    brand: number;
    fans: number;
  };
  phase: number;
  /** Phase-2 gate reached (office purchasable). */
  officeReady: boolean;
  tutorial: TutorialStep;
  draft: PhoneDesign;
  dev: Development | null;
  products: Product[];
  nextProductId: number;
  unlockedColors: string[];
  completedGoals: string[];
  stats: {
    launches: number;
    unitsTotal: number;
    revenueTotal: number;
    profitTotal: number;
    bestReview: number;
  };
  /** Weekly cash history (last 104 weeks) for charts. */
  cashHistory: number[];
}
