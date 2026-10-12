// Market & sales formulas (GDD §6.1, §7).

import { garageKit, GARAGE_ASSEMBLY_COST, LICENSED_OS, DEV_COST_PER_POINT } from '../../data/components';
import { finishById, materialById, PACKAGING, shapeById } from '../../data/design';
import { inflation } from '../../data/eras';
import { COMPETITORS, SEGMENT_SHARES, SEGMENTS, restMarketAttractiveness, type Segment } from '../../data/market';
import { clamp, fairPrice, overallRating } from '../scoring/score';
import type { PhoneDesign, Product } from '../state';

/** Total smartphone market in units per week (GDD §7.1). */
export function marketSize(year: number): number {
  const base = 50_000 + 12_000_000 / (1 + Math.exp(-0.6 * (year - 2012.5)));
  return base * (1 + 0.01 * Math.max(0, year - 2020));
}

export function segmentShare(segment: Segment, year: number): number {
  const rows = SEGMENT_SHARES;
  if (year <= rows[0].year) return rows[0][segment];
  for (let i = 1; i < rows.length; i++) {
    if (year <= rows[i].year) {
      const a = rows[i - 1];
      const b = rows[i];
      const t = (year - a.year) / (b.year - a.year);
      return a[segment] + (b[segment] - a[segment]) * t;
    }
  }
  return rows[rows.length - 1][segment];
}

export function brandFactor(brand: number): number {
  return 0.4 + (1.2 * clamp(brand, 0, 100)) / 100;
}

/** Unit cost of a design at production time (GDD §6.1). */
export function unitCost(design: PhoneDesign): number {
  const kit = garageKit(design.kitYear);
  const area = Math.pow(design.displaySize / 3.5, 2);
  const parts =
    kit.cost.chip + kit.cost.battery + kit.cost.camera + kit.cost.storage + kit.cost.ram + kit.cost.display * area;
  const inf = inflation(design.kitYear);
  const shape = shapeById(design.shapeId);
  const os = LICENSED_OS[design.osId as keyof typeof LICENSED_OS] ?? LICENSED_OS.leafline;
  return (
    parts +
    (materialById(design.materialId).cost + finishById(design.finishId).cost + shape.cost + PACKAGING.basic.cost) * inf +
    GARAGE_ASSEMBLY_COST * inf +
    os.feePerUnit
  );
}

/** Unit cost of an existing product today: parts get cheaper over time. */
export function currentUnitCost(product: Product, year: number): number {
  const age = Math.max(0, year - (2007 + product.launchDay / 364));
  return product.unitCost * (0.3 + 0.7 * Math.max(0.25, Math.exp(-0.25 * age)));
}

export function devPoints(design: PhoneDesign): { design: number; tech: number; software: number } {
  const kit = garageKit(design.kitYear);
  const shape = shapeById(design.shapeId);
  return {
    design: kit.dev.design + shape.devPoints,
    tech: kit.dev.tech + (design.displaySize > 3.5 ? 1 : 0),
    software: kit.dev.software,
  };
}

export function devCost(design: PhoneDesign): number {
  const p = devPoints(design);
  return (p.design + p.tech + p.software) * DEV_COST_PER_POINT * inflation(design.kitYear);
}

/** Founder output per day in the garage. */
export const FOUNDER_POINTS_PER_DAY = 2;

export function devDays(design: PhoneDesign): number {
  const p = devPoints(design);
  return Math.ceil(Math.max(p.design, p.tech, p.software) / FOUNDER_POINTS_PER_DAY);
}

/** Competitor rating in steady state (GDD §12; static line-up in M1). */
export function competitorReview(tau: number, designBias: number): number {
  return clamp(7 + 3 * Math.log2(tau) + 0.4 * designBias + 0.2, 0, 10);
}

/** Sum of reach-weighted competitor attractiveness in a segment. */
export function competitorPressure(segment: Segment): number {
  let sum = 0;
  for (const c of COMPETITORS) {
    if (!c.segments.includes(segment)) continue;
    const r = competitorReview(c.tau, c.designBias);
    sum += Math.pow(r / 10, 3) * brandFactor(c.brand) * c.reach;
  }
  return sum;
}

export interface AttractivenessInput {
  design: PhoneDesign;
  /** Current review (R_cur). */
  review: number;
  brand: number;
  weeksSinceLaunch: number;
  hype?: number;
}

export const KAPPA = 3;
export const LIFE_TAU_WEEKS = 40;

/** Attractiveness A_i (GDD §7.3). */
export function attractiveness(input: AttractivenessInput, year: number): number {
  const seg = SEGMENTS[input.design.segment];
  const p = overallRating(input.design, year).p;
  const pRef = fairPrice(input.design, p, year);
  const priceF = clamp(Math.pow(pRef / input.design.price, seg.elasticity), 0.05, 3);
  const h = (1.5 * (input.hype ?? 0)) / 100;
  const life = (1 + h * Math.exp(-input.weeksSinceLaunch / 2)) * Math.exp(-input.weeksSinceLaunch / LIFE_TAU_WEEKS);
  return Math.pow(clamp(input.review, 0, 10) / 10, KAPPA) * priceF * brandFactor(input.brand) * life;
}

/** Weekly demand for a set of player products in one segment. */
export function weeklyDemand(
  playerA: number[],
  segment: Segment,
  year: number,
  reach: number,
): number[] {
  const denom = restMarketAttractiveness(year) + competitorPressure(segment) + playerA.reduce((a, b) => a + b, 0);
  const segMarket = marketSize(year) * segmentShare(segment, year) * reach;
  return playerA.map((a) => (segMarket * a) / denom);
}
