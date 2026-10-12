// Serializable game state. Plain JSON only (no classes, Maps or Dates).

import type { TechCategory } from '../data/components';
import type { Segment } from '../data/market';
import type { Tempo } from '../data/factory';
import type { Role, TraitId } from '../data/team';

export const SAVE_VERSION = 7;

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
  /** Tech multiplier from frontier research (snapshot when the design is made). */
  techBoost?: number;
  /** Own chip: TI as a share of the year's flagship expectation, and unit cost. */
  ownChip?: { ratio: number; cost: number };
  /** Own OS score 0–10 (snapshot). */
  osScore?: number;
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
  /** Recent scrap share of own-factory production (returns cost review points). */
  defectRate?: number;
  /** Cached regional taste fit (region id → 0.7–1.3). */
  fit?: Record<string, number>;
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

export interface RivalModel {
  name: string;
  segment: Segment;
  review: number;
  price: number;
  launchDay: number;
}

export interface RivalState {
  id: string;
  brand: number;
  /** Drift of the tech aggressiveness τ from good or bad years. */
  tauAdj: number;
  models: RivalModel[];
  launches: number;
  nextLaunch: number;
  priceCutUntil: number;
  scandalUntil: number;
  unitsYear: number;
  unitsLastYear: number;
}

/** News ticker entry; the UI turns it into a sentence. */
export interface NewsItem {
  day: number;
  kind: string;
  rival?: string;
  text?: string;
  value?: number;
  segment?: string;
  region?: string;
}

export type EventId =
  | 'chipShortage'
  | 'cameraHype'
  | 'recession'
  | 'rivalScandal'
  | 'recall'
  | 'tradeFair'
  | 'influencer'
  | 'starApplicant'
  | 'tariff'
  | 'breakthrough';

export interface ActiveEvent {
  id: EventId;
  start: number;
  until: number;
  /** Rival or region the event is about. */
  target?: string;
}

/** An event card waiting for the player's decision. */
export interface PendingChoice {
  id: EventId;
  options: string[];
  /** Day the default option is taken automatically. */
  deadline: number;
  target?: string;
  /** Money involved (recall cost, expensive chips …). */
  amount?: number;
}

export interface EventState {
  active: ActiveEvent[];
  /** Event id → day it may fire again. */
  cooldown: Record<string, number>;
  pending: PendingChoice | null;
  /** Next presentation at half price with +20 hype (trade fair invitation). */
  tradeFair: boolean;
}

export interface Contract {
  id: number;
  /** Client name key (fictional carriers, companies, agencies). */
  client: string;
  segment: Segment;
  minReview: number;
  /** Highest unit cost the client accepts. */
  maxCost: number;
  units: number;
  /** Day the delivery is due (late: −10 %/week, cancelled after 4 weeks). */
  deadline: number;
  payout: number;
  accepted: boolean;
}

export interface RegionState {
  /** Region ids the company sells in ('home' always). */
  entered: string[];
  /** Region id → number of own stores. */
  stores: Record<string, number>;
}

export interface SideProduct {
  tier: string;
  priceLevel: string;
  launchDay: number;
  gen: number;
  units: number;
  revenue: number;
}

export interface DeptProject {
  progress: number;
  need: number;
}

export interface GiantState {
  campus: number;
  chip: { level: number; project: DeptProject | null; licensing: boolean; licensees: string[] };
  os: { level: number; project: DeptProject | null; installed: number; licensing: boolean; licensees: string[] };
  side: { watch: SideProduct | null; earbuds: SideProduct | null; tablet: SideProduct | null };
  /** Rival ids taken over. */
  acquired: string[];
  /** Licence income last week (for the UI). */
  licenceWeek: number;
}

export interface HallEntry {
  kind: string;
  name: string;
  value: number;
  year: number;
  color?: string | null;
}

/** Carried over to every new company (prestige). */
export interface Legacy {
  /** Legacy points available to spend. */
  points: number;
  /** Bonus levels bought. */
  bonuses: Record<string, number>;
  runs: number;
  /** Peak valuation over all runs. */
  peakValuation: number;
  hall: HallEntry[];
  achievements: string[];
  scenario: string | null;
}

export interface FactoryLine {
  id: number;
  /** 1–10. */
  level: number;
  /** Product the line builds (null = idle). */
  productId: number | null;
  paused: boolean;
  /** Fractional units carried between days. */
  carry: number;
  /** Units built last week / this week (for the UI). */
  lastWeek: number;
  week: number;
}

export interface FactoryState {
  /** 0 = no factory, 1 small (2 lines), 2 factory (4), 3 mega (8). */
  size: number;
  lines: FactoryLine[];
  nextLineId: number;
  tempo: Tempo;
  warehouse: number;
  /** Lines keep this many weeks of demand in stock. */
  targetWeeks: number;
  /** Everything spent on the factory (drives upkeep and valuation). */
  invested: number;
  produced: number;
  scrapped: number;
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
    /** Paid back to the bank at the last week end (optional: added after save v4). */
    lastRepay?: number;
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
    /** Completed frontier research levels (+2 % tech each). */
    frontier?: number;
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
  factory: FactoryState;
  rivals: RivalState[];
  news: NewsItem[];
  events: EventState;
  regions: RegionState;
  contracts: { offers: Contract[]; nextId: number; nextOfferDay: number; done: number };
  giant: GiantState;
  phase5Ready: boolean;
  phase6Ready: boolean;
  /** Records of this run (best review, best seller …). */
  hall: HallEntry[];
  achievements: string[];
  peakValuation: number;
  legacy: Legacy;
  /** Phase-4 gate reached (expansion – next update). */
  phase4Ready: boolean;
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
  week: { revenue: number; profit: number; units: number; ownOs?: number };
}
