// Hardware categories and company-level constants. The part catalogue lives in parts.ts.

export type TechCategory = 'chip' | 'display' | 'battery' | 'camera' | 'storage' | 'ram';

export const TECH_CATEGORIES: TechCategory[] = ['chip', 'display', 'battery', 'camera', 'storage', 'ram'];

/** Default tech weights (GDD §5.3). */
export const TECH_WEIGHTS: Record<TechCategory, number> = {
  chip: 0.25,
  display: 0.25,
  battery: 0.15,
  camera: 0.15,
  storage: 0.1,
  ram: 0.1,
};

/** Assembly cost per unit in the garage (hand assembly). */
export const GARAGE_ASSEMBLY_COST = 18;
/** Garage capacity in units per week. */
export const GARAGE_CAPACITY_WEEK = 50;
/** Weekly garage upkeep ($). */
export const GARAGE_UPKEEP_WEEK = 500;
/** Money per development point. */
export const DEV_COST_PER_POINT = 40;

export const LICENSED_OS = {
  leafline: { score: 5, feePerUnit: 0 },
  mosaic: { score: 7, feePerUnit: 8 },
} as const;

/** Office (Phase 2) – rent, research output and contract manufacturing. */
export const OFFICE_PRICE = 25_000;
export const OFFICE_RENT_WEEK = 3_000;
export const OFFICE_REACH = 0.0025;
/** Share of the shelf price kept by sales channels: online shop, retail, carriers. */
export const CHANNEL_CUT = { online: 0.1, retail: 0.25, carrier: 0.3 } as const;
/** Operations (support, logistics, warranty) as a share of revenue, from the office on. */
export const OPERATIONS_RATE = 0.12;
export const FOUNDER_RP_PER_DAY = 4;
/** Lab budget: weekly $ (2007) per extra research point per day. */
export const LAB_COST_PER_RP = 2_500;
/** Lab budget steps offered in the UI (2007 $ per week). */
export const LAB_BUDGETS = [0, 5_000, 20_000, 50_000, 150_000, 500_000];
/** Contract manufacturer: markup on unit cost, lead time for re-orders, minimum batch. */
export const OEM_MARKUP = 1.2;
export const OEM_ASSEMBLY_COST = 12;
export const OEM_LEAD_DAYS = 14;
export const OEM_MIN_BATCH = 100;
/** Storage cost per unit in stock per week, as a share of unit cost. */
export const STORAGE_RATE = 0.005;
/** Presentation stages: cost (2007 $) and hype. */
export const PRESENTATIONS = [
  { level: 0, cost: 0, hype: 0 },
  { level: 1, cost: 8_000, hype: 15 },
  { level: 2, cost: 40_000, hype: 28 },
];
/** Bank loan whenever cash runs dry (GDD §24.3 bankruptcy protection). */
export const LOAN_BUFFER = 15_000;
/** Weekly interest on debt and share of a positive week's profit used for repayment. */
export const LOAN_INTEREST_WEEK = 0.002;
export const LOAN_REPAY_SHARE = 0.25;
/** Credit line for production batches: base + share of last year's revenue. */
export const CREDIT_BASE = 40_000;
export const CREDIT_REVENUE_SHARE = 0.1;
