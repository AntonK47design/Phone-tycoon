// Serializable game state. Plain JSON only (no classes, Maps or Dates).

import type { TechCategory } from '../data/components';
import type { Segment } from '../data/market';
import type { Role, TraitId } from '../data/team';

export const SAVE_VERSION = 4;

export interface PhoneDesign {
  name: string;
  segment: Segment;
  price: number;
  /** Player-set price (Phase 2+). null = use the suggested fair price. */
  customPrice: number | null;
  /** null = unpainted prototype. */
  colorId: string | null;
  shapeId: string;
  displaySize: number;
  materialId: string;
  finishId: string;
  osId: string;
  /** Design year (drives display aspect ratio). */
  kitYear: number;
  /** Component id per tech category. */
  parts: Record<TechCategory, string>;
  /** Extra feature ids (wifi, net3g, gps, …). */
  features: string[];
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

export interface ProductionOrder {
  units: number;
  arriveDay: number;
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
  /** Demand (wanted units, sold or not) this week and last week. */
  weekDemand: number;
  lastWeekDemand: number;
  /** Fractional units carried between days (determinism without rounding drift). */
  carry: number;
  active: boolean;
  /** Was the demand capped by capacity/stock during the last week? */
  capped: boolean;
  /** Garage products are built to order; office products come from batches. */
  madeToOrder: boolean;
  stock: number;
  /** Customers waiting for stock (GDD §7.6). */
  backlog: number;
  orders: ProductionOrder[];
  /** Current hype 0–100 (decays weekly). */
  hype: number;
  launchHype: number;
}

export interface Development {
  design: PhoneDesign;
  required: { design: number; tech: number; software: number };
  progress: { design: number; tech: number; software: number };
  done: boolean;
}

export interface Employee {
  id: number;
  first: string;
  last: string;
  role: Role;
  /** 1–100. */
  skill: number;
  /** 0–100. */
  morale: number;
  trait: TraitId;
  hiredDay: number;
  /** Day until which the person is away for training (null = working). */
  trainingUntil: number | null;
  /** Visual seed for the 3D figure (hair, skin). */
  look: number;
}

export interface TeamState {
  staff: Employee[];
  applicants: Employee[];
  nextId: number;
  /** Day the applicant pool was last refreshed. */
  poolDay: number;
  /** Startup office stage 1–4 (0 = still in the garage). */
  office: number;
  /** Research lab and design studio levels (0 = not built). */
  lab: number;
  studio: number;
  /** Temporary morale boost from bonuses (decays weekly). */
  boost: number;
  lastBonusDay: number;
}

export type DailyKind = 'sell' | 'revenue' | 'launch' | 'research' | 'hire' | 'train' | 'reorder';

export interface DailyOrder {
  kind: DailyKind;
  target: number;
  /** Counter value when the order was created (progress = counter − base). */
  base: number;
  /** Creation day (for launch orders: products launched after this day count). */
  day: number;
  reward: { cash?: number; hype?: number };
  done: boolean;
  claimed: boolean;
}

export interface DailyState {
  /** Real-world date (YYYY-MM-DD) of the current mini orders. */
  date: string | null;
  orders: DailyOrder[];
  /** Calendar position 0–6 (next reward index). */
  calendarStep: number;
  /** Completed 7-day cycles. */
  cycles: number;
  lastClaim: string | null;
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
    /** Outstanding bank loan. */
    debt: number;
  };
  /** 1 = garage, 2 = startup office. */
  phase: number;
  /** Phase-2 gate reached (office purchasable). */
  officeReady: boolean;
  /** Phase-3 gate reached (studio & factory – next update). */
  phase3Ready: boolean;
  tutorial: TutorialStep;
  draft: PhoneDesign;
  dev: Development | null;
  products: Product[];
  nextProductId: number;
  unlockedColors: string[];
  completedGoals: string[];
  research: {
    done: string[];
    current: { id: string; progress: number } | null;
    /** Weekly lab budget in today's $ (buys extra research points). */
    budget: number;
  };
  stats: {
    launches: number;
    unitsTotal: number;
    revenueTotal: number;
    profitTotal: number;
    bestReview: number;
    bestLaunchHype: number;
    hires: number;
    trainings: number;
    reorders: number;
  };
  team: TeamState;
  daily: DailyState;
  /** Cosmetic unlocks (e.g. the calendar's aurora finish). */
  cosmetics: string[];
  /** Weekly history (last 52 weeks). */
  history: {
    cash: number[];
    revenue: number[];
    profit: number[];
    playerUnits: number[];
    /** Competitor id → weekly units. "_rest" = no-name / feature phones. */
    compUnits: Record<string, number[]>;
  };
  /** Running week accumulators. */
  week: { revenue: number; profit: number; units: number };
}
