// Market & sales formulas (GDD §6, §7).

import {
  DEV_COST_PER_POINT,
  GARAGE_ASSEMBLY_COST,
  LICENSED_OS,
  OEM_ASSEMBLY_COST,
  OEM_MARKUP,
} from '../../data/components';
import { lineAssembly } from '../../data/factory';
import { finishById, materialById, PACKAGING, shapeById } from '../../data/design';
import { inflation } from '../../data/eras';
import { COMPETITORS, curveAt, SEGMENT_SHARES, SEGMENTS, restMarketAttractiveness, type Segment } from '../../data/market';
import { featureById, partById, partCostAt } from '../../data/parts';
import { clamp, fairPrice, overallRating } from '../scoring/score';
import type { PhoneDesign } from '../state';

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

export type BuildMode = 'garage' | 'oem' | 'factory';

const BODY_GRADE: Partial<Record<Segment, number>> = { budget: 0.5, senior: 0.6, mid: 0.75 };

/** Unit cost of a design built in `year` (GDD §6.1). */
export function unitCost(design: PhoneDesign, year: number, mode: BuildMode = 'garage', lineLevel = 1): number {
  const inf = inflation(Math.floor(year));
  // Panels get cheaper per inch as they grow common: cost ∝ size^1.2 (not area).
  const area = Math.pow(design.displaySize / 3.5, 1.2);
  let parts = 0;
  for (const [category, id] of Object.entries(design.parts)) {
    const part = partById(id);
    if (!part) continue;
    parts += partCostAt(part, year) * (category === 'display' ? area : 1);
  }
  // Own chip: 0.6 × the market chip of the same generation (GDD §15.1).
  if (design.parts.chip === 'own-chip' && design.ownChip) parts += design.ownChip.cost * Math.max(0.25, Math.exp(-0.25 * Math.max(0, year - design.kitYear)));
  // Extras and materials get cheaper as they age, like parts (down to 30 % / 40 %).
  const extras = design.features.reduce((a, f) => {
    const def = featureById(f);
    if (!def) return a;
    const age = Math.max(0, year - (def.expected.flagship - 1));
    return a + def.cost * Math.max(0.3, Math.exp(-0.18 * age));
  }, 0);
  const matDef = materialById(design.materialId);
  const matCost = matDef.cost * Math.max(0.4, Math.exp(-0.1 * Math.max(0, year - matDef.year)));
  const os = design.osId === 'own' ? { feePerUnit: 0 } : LICENSED_OS[design.osId as keyof typeof LICENSED_OS] ?? LICENSED_OS.leafline;
  // Cheaper segments use a cheaper build grade for body, finish and extras.
  const grade = BODY_GRADE[design.segment] ?? 1;
  const body =
    grade * (matCost + finishById(design.finishId).cost + shapeById(design.shapeId).cost + PACKAGING.basic.cost + extras) * inf;
  if (mode === 'garage') return parts + body + GARAGE_ASSEMBLY_COST * inf + os.feePerUnit;
  // Own line: no contract manufacturer markup, assembly gets cheaper with the line level.
  if (mode === 'factory') return parts + body + lineAssembly(lineLevel) * inf + os.feePerUnit;
  return (parts + body + OEM_ASSEMBLY_COST * inf) * OEM_MARKUP + os.feePerUnit;
}

/** Volume discount on a production batch (GDD §6.1). */
export function volumeDiscount(units: number): number {
  return clamp(1 - 0.08 * Math.log10(Math.max(1, units) / 1000), 0.75, 1);
}

export function devPoints(design: PhoneDesign): { design: number; tech: number; software: number } {
  const shape = shapeById(design.shapeId);
  const mat = design.materialId === 'plastic' ? 0 : design.materialId === 'aluminium' ? 2 : 3;
  let tech = 0;
  let software = 2;
  for (const id of Object.values(design.parts)) {
    const part = partById(id);
    if (!part) continue;
    if (part.dev.type === 'tech') tech += part.dev.points;
    else software += part.dev.points;
  }
  for (const f of design.features) tech += featureById(f)?.devPoints ?? 0;
  if (design.osId !== 'leafline') software += 1;
  if (design.displaySize > 3.5) tech += Math.round((design.displaySize - 3.5) * 2);
  return { design: 6 + shape.devPoints + mat + (design.finishId !== 'gloss' ? 1 : 0), tech, software };
}

export function devCost(design: PhoneDesign): number {
  const p = devPoints(design);
  return (p.design + p.tech + p.software) * DEV_COST_PER_POINT * inflation(design.kitYear);
}

/** Founder output per day (staff arrive in M3). */
export const FOUNDER_POINTS_PER_DAY = 2;

export function devDays(design: PhoneDesign): number {
  const p = devPoints(design);
  return Math.ceil(Math.max(p.design, p.tech, p.software) / FOUNDER_POINTS_PER_DAY);
}

/** Competitor rating in steady state (GDD §12; static line-up until M5). */
export function competitorReview(tau: number, designBias: number): number {
  return clamp(7 + 3 * Math.log2(tau) + 0.4 * designBias + 0.2, 0, 10);
}

export const KAPPA = 3;
export const LIFE_TAU_WEEKS = 40;

export interface AttractivenessInput {
  design: PhoneDesign;
  /** Current review (R_cur). */
  review: number;
  brand: number;
  weeksSinceLaunch: number;
  hype?: number;
}

/** Attractiveness A_i (GDD §7.3). */
export function attractiveness(input: AttractivenessInput, year: number): number {
  return attractivenessParts(input, year).a;
}

/**
 * Attractiveness plus the price ratio and elasticity, so callers can re-weight the price
 * factor for a more price-sensitive region without recomputing the ratings.
 */
export function attractivenessParts(input: AttractivenessInput, year: number): { a: number; ratio: number; eps: number } {
  const seg = SEGMENTS[input.design.segment];
  const p = overallRating(input.design, year).p;
  const pRef = fairPrice(input.design, p, year);
  const ratio = pRef / Math.max(1, input.design.price);
  const priceF = priceFactor(ratio, seg.elasticity);
  const hype = input.hype ?? 0;
  const spike = ((1.5 * hype) / 100) * Math.exp(-input.weeksSinceLaunch / 2);
  const life = (1 + spike) * Math.exp(-input.weeksSinceLaunch / LIFE_TAU_WEEKS);
  const mkt = 1 + (0.6 * hype) / 100;
  const a = Math.pow(clamp(input.review, 0, 10) / 10, KAPPA) * priceF * brandFactor(input.brand) * life * mkt;
  return { a, ratio, eps: seg.elasticity };
}

export function priceFactor(ratio: number, eps: number): number {
  return clamp(Math.pow(ratio, eps), 0.03, 3);
}

export interface SegmentResult {
  /** Weekly units for each player entry. */
  player: number[];
  /** Weekly units per competitor id, plus "_rest" (no-name / feature phones). */
  comps: Record<string, number>;
}

/** A rival in a segment: id and effective attractiveness (A × reach). */
export interface RivalEntry {
  id: string;
  e: number;
}

/** Static rival line-up (used before the dynamic competitors exist, e.g. in tests). */
export function staticRivals(segment: Segment, year: number): RivalEntry[] {
  return COMPETITORS.filter((c) => c.segments.includes(segment)).map((c) => {
    const r = competitorReview(curveAt(c.tau, year), c.designBias);
    return { id: c.id, e: Math.pow(r / 10, KAPPA) * brandFactor(c.brand) * curveAt(c.reach, year) };
  });
}

/**
 * Splits a segment's weekly demand between player products, competitors and the rest of
 * the market. Every product competes with its effective attractiveness A × reach.
 * `size` scales the market (regions, recession).
 */
export function segmentDemand(
  players: { a: number; reach: number }[],
  segment: Segment,
  year: number,
  rivals: RivalEntry[] = staticRivals(segment, year),
  size = 1,
): SegmentResult {
  const total = marketSize(year) * segmentShare(segment, year) * size;
  const comps: Record<string, number> = {};
  const rest = restMarketAttractiveness(year);
  let denom = rest;
  for (const r of rivals) denom += r.e;
  for (const p of players) denom += p.a * p.reach;
  for (const r of rivals) comps[r.id] = (comps[r.id] ?? 0) + (total * r.e) / denom;
  comps._rest = (total * rest) / denom;
  return { player: players.map((p) => (total * p.a * p.reach) / denom), comps };
}
