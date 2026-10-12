// Regions (GDD §14). The home market is the calibrated market of phases 1–3.

import type { Segment } from './market';

export type RegionId = 'home' | 'europe' | 'asia' | 'latam' | 'africa';

export interface RegionDef {
  id: RegionId;
  /** Share of the world market (home = 0.18 → the base market size). */
  share: number;
  /** Price sensitivity: multiplies the segment elasticity. */
  priceSens: number;
  /** Entry price (2007 $). */
  entry: number;
  /** Segment popularity. */
  segments: Partial<Record<Segment, number>>;
  /** What customers care about: weight on design / camera / battery / performance ratings. */
  prefs: { design?: number; camera?: number; battery?: number; performance?: number; waterproof?: number };
  /** Rivals that are especially strong here. */
  rivalBoost?: Record<string, number>;
  /** Map tile position (0–1) for the world panel. */
  map: [number, number];
}

export const HOME_SHARE = 0.18;

export const REGIONS: RegionDef[] = [
  { id: 'home', share: 0.18, priceSens: 1.0, entry: 0, segments: { flagship: 1.15, budget: 0.95 }, prefs: { performance: 0.1 }, map: [0.22, 0.38] },
  { id: 'europe', share: 0.2, priceSens: 1.1, entry: 2_000_000, segments: { mid: 1.1 }, prefs: { design: 0.15, battery: 0.1 }, map: [0.5, 0.3] },
  { id: 'asia', share: 0.4, priceSens: 1.2, entry: 5_000_000, segments: { budget: 1.1, mid: 1.1, gaming: 1.3 }, prefs: { camera: 0.15, performance: 0.1 }, rivalBoost: { pebblecom: 2 }, map: [0.8, 0.4] },
  { id: 'latam', share: 0.1, priceSens: 1.4, entry: 1_500_000, segments: { budget: 1.2, flagship: 0.8 }, prefs: { battery: 0.1 }, map: [0.24, 0.78] },
  { id: 'africa', share: 0.12, priceSens: 1.5, entry: 1_500_000, segments: { budget: 1.25, flagship: 0.7, senior: 1.1 }, prefs: { battery: 0.15, waterproof: 0.1 }, map: [0.6, 0.64] },
];

export function regionById(id: string): RegionDef {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

/** Own store: price (2007 $), weekly rent, reach multiplier per store, one-time brand. */
export const STORE_PRICE = 1_000_000;
export const STORE_RENT = 20_000;
export const STORE_REACH = 0.15;
export const STORE_BRAND = 2;
export const MAX_STORES = 5;
/** Reach in a newly entered region relative to the home reach. */
export const FOREIGN_REACH = 0.5;

/** Fictional contract clients (carriers, companies, agencies). */
export const CLIENTS = ['carrierNorth', 'skylink', 'metroTel', 'cityHall', 'fleetCo', 'eduNet', 'medica', 'courierOne'];
