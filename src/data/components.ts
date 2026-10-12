// Hardware components. In Phase 1 the player uses the "garage kit": a mid-range parts
// bundle that tracks the current year. Individual component tiers arrive in M2.

import { expectedTech, inflation } from './eras';

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

export interface KitDef {
  year: number;
  /** Tech index per category. */
  ti: Record<TechCategory, number>;
  /** Unit cost per category in $ (display cost is for a 3.5" panel; scales with area). */
  cost: Record<TechCategory, number>;
  /** Development points per type. */
  dev: { design: number; tech: number; software: number };
}

/** Mid-range share of the flagship expectation. */
const KIT_TIER = 0.6;

export function garageKit(year: number): KitDef {
  const y = Math.floor(year);
  const ti = KIT_TIER * expectedTech(y);
  const inf = inflation(y);
  return {
    year: y,
    ti: { chip: ti, display: ti, battery: ti, camera: ti, storage: ti, ram: ti },
    cost: {
      chip: 34 * inf,
      display: 28 * inf,
      battery: 8 * inf,
      camera: 9 * inf,
      storage: 10 * inf,
      ram: 8 * inf,
    },
    dev: { design: 6, tech: 6, software: 4 },
  };
}

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
} as const;
