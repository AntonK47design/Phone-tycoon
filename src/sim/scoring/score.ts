// Score formulas (GDD §5). Pure functions, no state mutation.

import {
  eraForYear,
  expectedDisplaySize,
  expectedScreenToBody,
  expectedTech,
  expectedThickness,
  trendColors,
} from '../../data/eras';
import { LICENSED_OS, TECH_CATEGORIES, TECH_WEIGHTS, type TechCategory } from '../../data/components';
import { FEATURES, featureById, featureExpected, partById } from '../../data/parts';
import { finishById, materialById, PACKAGING } from '../../data/design';
import { PRICE_LADDER, SEGMENTS, type Segment } from '../../data/market';
import { phoneDims } from '../phoneSpec';
import type { PhoneDesign } from '../state';

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Category rating from relative performance r (GDD §5.2). */
export function ratingFromRatio(r: number): number {
  return clamp(7 + 3 * Math.log2(Math.max(r, 1e-6)), 0, 10);
}

export interface TechBreakdown {
  score: number;
  categories: Record<TechCategory, number>;
}

/** Relative battery drain of a design (1 = 3.5" reference). */
export function batteryDrain(design: PhoneDesign): number {
  let drain = Math.pow(design.displaySize / 3.5, 2);
  for (const id of design.features) drain *= featureById(id)?.drain ?? 1;
  return drain;
}

export const OWN_CHIP_ID = 'own-chip';

export function partTi(design: PhoneDesign, category: TechCategory): number {
  const boost = design.techBoost ?? 1;
  // Own chip: a share of the flagship expectation of the design year (GDD §15.1).
  if (category === 'chip' && design.parts.chip === OWN_CHIP_ID && design.ownChip) return design.ownChip.ratio * expectedTech(design.kitYear) * boost;
  return (partById(design.parts[category])?.ti ?? 0) * boost;
}

/**
 * How buyers of a segment rate a part (GDD §5.2, revised). Parts are graded against the
 * year's top hardware (ratio 1 = flagship level); each segment needs a certain level
 * (σ_s). Meeting it gives 7, falling short costs 1 point per step, and going beyond only
 * pays up to the segment's headroom: budget buyers don't pay for flagship chips.
 */
export function segmentTechRating(ratio: number, segment: Segment): number {
  const seg = SEGMENTS[segment];
  const absolute = ratingFromRatio(ratio);
  const need = 7 + 3 * Math.log2(seg.sigma);
  const d = absolute - need;
  if (d <= 0 || seg.headroom === Infinity) return clamp(7 + d, 0, 10);
  return clamp(7 + seg.headroom * (1 - Math.exp(-d / seg.headroom)), 0, 10);
}

export function techScore(design: PhoneDesign, year: number): TechBreakdown {
  const expected = expectedTech(year);
  const categories = {} as Record<TechCategory, number>;
  let score = 0;
  for (const k of TECH_CATEGORIES) {
    let ti = partTi(design, k);
    if (k === 'battery') ti /= batteryDrain(design);
    const s = segmentTechRating(ti / expected, design.segment);
    categories[k] = s;
    score += TECH_WEIGHTS[k] * s;
  }
  return { score: clamp(score, 0, 10), categories };
}

export interface DesignBreakdown {
  score: number;
  material: number;
  thickness: number;
  screenToBody: number;
  displaySize: number;
  color: number;
  proportion: number;
  packaging: number;
}

const DESIGN_WEIGHTS = {
  material: 0.25,
  thickness: 0.15,
  screenToBody: 0.2,
  displaySize: 0.1,
  color: 0.15,
  proportion: 0.1,
  packaging: 0.05,
};

export function isTrendColor(colorId: string | null, year: number): boolean {
  return colorId !== null && trendColors(year).includes(colorId);
}

export function designScore(design: PhoneDesign, year: number): DesignBreakdown {
  const dims = phoneDims(design);
  const seg = SEGMENTS[design.segment];
  const mat = materialById(design.materialId);
  const finish = finishById(design.finishId);

  const material = Math.max(2, mat.design - 0.15 * Math.max(0, year - mat.year));
  const eTh = expectedThickness(year);
  const thickness = clamp(7 + 12 * ((eTh - dims.thickness) / eTh), 0, 10);
  const screenToBody = clamp(7 + 25 * (dims.screenToBody - expectedScreenToBody(year)), 0, 10);
  const sweet = expectedDisplaySize(year) + seg.sizeOffset;
  const displaySize = clamp(10 - 4 * Math.abs(design.displaySize - sweet), 0, 10);
  let color = 2; // unpainted prototype
  if (design.colorId !== null) {
    color = 6 + (isTrendColor(design.colorId, year) ? 2 : 0) + finish.bonus;
  }
  color = clamp(color, 0, 10);
  const ratio = dims.corner / dims.width;
  const dist = ratio < 0.12 ? 0.12 - ratio : ratio > 0.2 ? ratio - 0.2 : 0;
  const proportion = clamp(9 - 30 * dist, 3, 9);
  const packaging = PACKAGING.basic.design;

  const parts = { material, thickness, screenToBody, displaySize, color, proportion, packaging };
  let score = 0;
  for (const key of Object.keys(DESIGN_WEIGHTS) as (keyof typeof DESIGN_WEIGHTS)[]) {
    score += DESIGN_WEIGHTS[key] * parts[key];
  }
  return { score: clamp(score, 0, 10), ...parts };
}

export function osAdjustment(design: PhoneDesign): number {
  if (design.osId === 'own') return ((design.osScore ?? 5) - 6) * 0.15;
  const os = LICENSED_OS[design.osId as keyof typeof LICENSED_OS] ?? LICENSED_OS.leafline;
  return (os.score - 6) * 0.15;
}

export function alphaFor(design: PhoneDesign, year: number): number {
  return eraForYear(year).alpha * SEGMENTS[design.segment].alphaMul;
}

export interface Rating {
  p: number;
  design: DesignBreakdown;
  tech: TechBreakdown;
  features: FeatureCheck;
}

export interface FeatureCheck {
  missing: string[];
  innovative: string[];
  adjustment: number;
}

/** Feature adjustment F (GDD §5.5): expected but missing costs, early adoption pays. */
export function featureAdjustment(design: PhoneDesign, year: number): FeatureCheck {
  const missing: string[] = [];
  const innovative: string[] = [];
  let malus = 0;
  let bonus = 0;
  for (const f of FEATURES) {
    const expected = featureExpected(f, design.segment);
    const has = design.features.includes(f.id);
    if (!has && year >= expected) {
      missing.push(f.id);
      malus += 0.4;
    } else if (has && year < expected) {
      innovative.push(f.id);
      bonus += 0.35 * clamp((expected - year) / 2, 0, 1);
    }
  }
  return { missing, innovative, adjustment: Math.min(1.5, bonus) - Math.min(2, malus) };
}

/** Overall rating P (GDD §5.7). */
export function overallRating(design: PhoneDesign, year: number): Rating {
  const d = designScore(design, year);
  const t = techScore(design, year);
  const a = alphaFor(design, year);
  const f = featureAdjustment(design, year);
  const p = clamp(a * d.score + (1 - a) * t.score + f.adjustment + osAdjustment(design), 0, 10);
  return { p, design: d, tech: t, features: f };
}

/** Price level of a year relative to 2007: inflation plus real growth from 2010 (max ×2). */
export function priceScale(year: number): number {
  const real = Math.min(2, Math.pow(1.03, Math.max(0, year - 2010)));
  return Math.pow(1.02, year - 2007) * real;
}

/** Segment price anchor including inflation. */
export function priceAnchor(design: Pick<PhoneDesign, 'segment'>, year: number): number {
  return SEGMENTS[design.segment].anchor * priceScale(year);
}

/**
 * Price band of a segment [low, high) in today's $. The ladder segments split at the
 * geometric midpoints between their anchors; niche segments use their own band.
 */
export function segmentBand(segment: Segment, year: number): [number, number] {
  const k = priceScale(year);
  const seg = SEGMENTS[segment];
  if (seg.nicheBand) return [seg.anchor * seg.nicheBand[0] * k, seg.anchor * seg.nicheBand[1] * k];
  const i = PRICE_LADDER.indexOf(segment);
  const mid = (a: Segment, b: Segment) => Math.sqrt(SEGMENTS[a].anchor * SEGMENTS[b].anchor) * k;
  const lo = i > 0 ? mid(PRICE_LADDER[i - 1], segment) : 0;
  const hi = i < PRICE_LADDER.length - 1 ? mid(segment, PRICE_LADDER[i + 1]) : Infinity;
  return [lo, hi];
}

/**
 * The segment a phone actually competes in: decided by its shelf price. A niche target
 * (senior, gaming) keeps its audience while the price stays in the niche's band.
 * `available` limits the result (scenario rules, locked segments): nearest rung wins.
 */
export function segmentForPrice(price: number, year: number, target: Segment, available: Segment[] = PRICE_LADDER): Segment {
  if (SEGMENTS[target].nicheBand && available.includes(target)) {
    const [lo, hi] = segmentBand(target, year);
    if (price >= lo && price < hi) return target;
  }
  const ladder = PRICE_LADDER.filter((s) => available.includes(s));
  if (!ladder.length) return target;
  let best = ladder[0];
  for (const s of ladder) if (price >= segmentBand(s, year)[0]) best = s;
  return best;
}

/** Fair price for a phone with rating p (GDD §5.9): steeper in pricier segments. */
export function fairPrice(design: PhoneDesign, p: number, year: number): number {
  return priceAnchor(design, year) * Math.pow(Math.max(p, 0.5) / 7, SEGMENTS[design.segment].valueSlope);
}

export function valueAdjustment(design: PhoneDesign, p: number, year: number): number {
  return clamp(1.2 * Math.log2(fairPrice(design, p, year) / design.price), -2, 1);
}

/** Rounds a price to a typical "…9" price point. */
export function roundPrice(x: number): number {
  if (x < 1000) return Math.max(9, Math.round(x / 10) * 10 - 1);
  return Math.round(x / 50) * 50 - 1;
}

/** Keeps a price inside [lo, hi), on a "…9" price point. */
export function priceInBand(x: number, [lo, hi]: [number, number]): number {
  let p = roundPrice(x);
  if (p >= hi) p = Math.floor(hi / 10) * 10 - 1;
  if (p < lo) p = Math.ceil((lo + 1) / 10) * 10 - 1;
  return p;
}

/**
 * Suggested price: 85 % of the fair price, kept inside the target segment's price band
 * (`banded` = false in the garage, where the segment is fixed and prices are free).
 */
export function suggestedPrice(design: PhoneDesign, year: number, banded = true): number {
  const { p } = overallRating(design, year);
  const x = 0.85 * fairPrice(design, p, year);
  return banded ? priceInBand(x, segmentBand(design.segment, year)) : roundPrice(x);
}

/** Effective shelf price: the player's own price if set, otherwise the suggestion. */
export function effectivePrice(design: PhoneDesign, year: number): number {
  return design.customPrice ?? suggestedPrice(design, year);
}

export interface ReviewEstimate {
  score: number;
  rating: Rating;
  value: number;
}

/**
 * Deterministic review score (GDD §5.11). `tutorial` clamps the very first launch
 * into 6.5–8.0 (GDD §19).
 */
export function reviewEstimate(design: PhoneDesign, year: number, opts: { q?: number; hype?: number; tutorial?: boolean; bonus?: number } = {}): ReviewEstimate {
  const q = opts.q ?? 1;
  const hype = opts.hype ?? 0;
  const rating = overallRating(design, year);
  const value = valueAdjustment(design, rating.p, year);
  const rHype = 5 + (4 * hype) / 100;
  const hypePenalty = 0.3 * Math.max(0, rHype - rating.p * q);
  let score = clamp(rating.p * q + (opts.bonus ?? 0) + value - hypePenalty, 0, 10);
  if (opts.tutorial) score = clamp(score, 6.5, 8.0);
  return { score: Math.round(score * 10) / 10, rating, value };
}

export type ReviewAspect = 'color' | 'shape' | 'thin' | 'display' | 'screen' | 'battery' | 'performance' | 'price';

/** Aspects with their current sub-rating, grouped by outlet focus. */
export function reviewAspects(est: ReviewEstimate): { design: [ReviewAspect, number][]; tech: [ReviewAspect, number][]; value: [ReviewAspect, number][] } {
  const d = est.rating.design;
  const t = est.rating.tech.categories;
  return {
    design: [
      ['color', d.color],
      ['shape', d.proportion],
      ['thin', d.thickness],
      ['screen', d.screenToBody],
    ],
    tech: [
      ['display', (t.display + d.displaySize) / 2],
      ['battery', t.battery],
      ['performance', (t.chip + t.ram) / 2],
    ],
    value: [['price', 7 + est.value * 2.5]],
  };
}
