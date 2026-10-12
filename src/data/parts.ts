// Component catalogue (GDD §4.1, §5.1). Every category gets a new generation each year
// in three tiers. A generation is unlocked by research; tiers within it are free.
// Tech index (TI) of a tier at release = tierShare × flagship expectation of that year.

import { expectedTech, inflation, START_YEAR } from './eras';
import type { TechCategory } from './components';

export type Tier = 'lite' | 'std' | 'pro';
export const TIERS: Tier[] = ['lite', 'std', 'pro'];

/** Share of the flagship expectation per tier (budget / mid / flagship grade). */
export const TIER_SHARE: Record<Tier, number> = { lite: 0.35, std: 0.6, pro: 1.0 };
const TIER_COST: Record<Tier, number> = { lite: 0.45, std: 0.7, pro: 1.0 };
const TIER_DEV: Record<Tier, number> = { lite: 0.7, std: 1, pro: 1.4 };

/** Flagship-tier cost in 2007 $ (display: 3.5" panel, scaled by area). */
const BASE_COST: Record<TechCategory, number> = { chip: 48, display: 40, battery: 11, camera: 14, storage: 15, ram: 12 };
/** Which development discipline a category loads. */
const DEV_TYPE: Record<TechCategory, 'tech' | 'software'> = {
  chip: 'tech', display: 'tech', battery: 'tech', camera: 'tech', storage: 'software', ram: 'software',
};
const BASE_DEV: Record<TechCategory, number> = { chip: 3, display: 2, battery: 1, camera: 2, storage: 1, ram: 1 };

export const FIRST_GEN = START_YEAR;
export const LAST_GEN = 2050;

export interface PartDef {
  id: string;
  category: TechCategory;
  gen: number;
  tier: Tier;
  ti: number;
  /** Cost at release (2007 $ × inflation of release year). */
  cost: number;
  dev: { type: 'tech' | 'software'; points: number };
  /** Display label, e.g. "Vexa V9 Pro" or "2400 mAh". */
  label: string;
}

const TIER_MUL: Record<Tier, number> = { lite: 0.55, std: 0.8, pro: 1.15 };

function pow2(x: number) {
  return Math.pow(2, Math.round(Math.log2(Math.max(1, x))));
}

function label(category: TechCategory, gen: number, tier: Tier): string {
  // Spec numbers grow more slowly after 2024 (like the expectation curve).
  const raw = gen - START_YEAR;
  const k = raw <= 17 ? raw : 17 + (raw - 17) * 0.45;
  const m = TIER_MUL[tier];
  const tierName = tier === 'lite' ? ' Lite' : tier === 'pro' ? ' Pro' : '';
  switch (category) {
    case 'chip':
      return `Vexa V${k + 1}${tierName} · ${Math.round((420 * Math.pow(1.22, k) * m) / 10) * 10} MHz`;
    case 'display': {
      const tech = gen < 2010 ? 'TFT' : gen < 2013 ? 'IPS' : gen < 2018 ? 'OLED' : gen < 2030 ? 'LTPO' : gen < 2040 ? 'MicroLED' : 'QuantumLED';
      const ppi = Math.round((150 * Math.pow(1.13, k) * m) / 5) * 5;
      return `${tech} ${ppi} ppi`;
    }
    case 'battery':
      return `Voltcell ${Math.round((1150 * Math.pow(1.09, k) * m) / 50) * 50} mAh`;
    case 'camera': {
      const mp = 2 * Math.pow(1.3, k) * m;
      return `${mp < 10 ? mp.toFixed(1) : Math.round(mp)} MP`;
    }
    case 'storage':
      return `${pow2(4 * Math.pow(1.45, k) * m)} GB`;
    case 'ram':
      return `${pow2(128 * Math.pow(1.4, k) * m)} MB RAM`;
  }
}

function build(): PartDef[] {
  const out: PartDef[] = [];
  const cats: TechCategory[] = ['chip', 'display', 'battery', 'camera', 'storage', 'ram'];
  for (const category of cats) {
    for (let gen = FIRST_GEN; gen <= LAST_GEN; gen++) {
      for (const tier of TIERS) {
        out.push({
          id: `${category}-${gen}-${tier}`,
          category,
          gen,
          tier,
          ti: TIER_SHARE[tier] * expectedTech(gen),
          cost: BASE_COST[category] * TIER_COST[tier] * inflation(gen),
          dev: { type: DEV_TYPE[category], points: Math.round(BASE_DEV[category] * TIER_DEV[tier] * (1 + 0.08 * Math.min(gen - START_YEAR, 25))) },
          label: label(category, gen, tier),
        });
      }
    }
  }
  return out;
}

export const PARTS: PartDef[] = build();
const BY_ID = new Map(PARTS.map((p) => [p.id, p]));

export function partById(id: string): PartDef | undefined {
  return BY_ID.get(id);
}

/** Price of a part today: cheaper every year after release (GDD §6.1). */
export function partCostAt(part: PartDef, year: number): number {
  return part.cost * Math.max(0.25, Math.exp(-0.25 * Math.max(0, year - part.gen)));
}

/** Default parts: the 2007 generation, tier matching the segment. */
export function defaultParts(tier: Tier, gen = FIRST_GEN): Record<TechCategory, string> {
  return {
    chip: `chip-${gen}-${tier}`,
    display: `display-${gen}-${tier}`,
    battery: `battery-${gen}-${tier}`,
    camera: `camera-${gen}-${tier}`,
    storage: `storage-${gen}-${tier}`,
    ram: `ram-${gen}-${tier}`,
  };
}

// ── Extras / features (GDD §5.5, §8.2) ───────────────────────────────────

export interface FeatureDef {
  id: string;
  cost: number;
  devPoints: number;
  /** Year from which each segment expects it (Infinity = never expected). */
  expected: { budget: number; mid: number; flagship: number };
  /** Battery drain multiplier. */
  drain: number;
  /** Available without research (and always fitted in the garage). */
  starter?: boolean;
}

/** Year a segment expects a feature: seniors expect what budget phones have, gamers what flagships have. */
export function featureExpected(f: { expected: { budget: number; mid: number; flagship: number } }, segment: string): number {
  if (segment === 'senior') return f.expected.budget;
  if (segment === 'gaming') return f.expected.flagship;
  return f.expected[segment as 'budget' | 'mid' | 'flagship'];
}

export const FEATURES: FeatureDef[] = [
  { id: 'net3g', cost: 9, devPoints: 2, expected: { budget: 2011, mid: 2009, flagship: 2008 }, drain: 1.06 },
  { id: 'gps', cost: 5, devPoints: 1, expected: { budget: 2012, mid: 2010, flagship: 2008 }, drain: 1.03 },
  { id: 'wifi', cost: 4, devPoints: 1, expected: { budget: 2010, mid: 2008, flagship: 2007 }, drain: 1.02, starter: true },
  { id: 'frontCam', cost: 6, devPoints: 1, expected: { budget: 2013, mid: 2011, flagship: 2010 }, drain: 1 },
  { id: 'net4g', cost: 16, devPoints: 3, expected: { budget: 2016, mid: 2014, flagship: 2012 }, drain: 1.08 },
  { id: 'fingerprint', cost: 12, devPoints: 2, expected: { budget: 2017, mid: 2015, flagship: 2014 }, drain: 1 },
  { id: 'waterproof', cost: 10, devPoints: 2, expected: { budget: 2021, mid: 2018, flagship: 2016 }, drain: 1 },
  { id: 'wireless', cost: 14, devPoints: 2, expected: { budget: 9999, mid: 2021, flagship: 2018 }, drain: 1 },
  { id: 'faceUnlock', cost: 18, devPoints: 3, expected: { budget: 2022, mid: 2019, flagship: 2018 }, drain: 1.02 },
  { id: 'net5g', cost: 24, devPoints: 3, expected: { budget: 2023, mid: 2021, flagship: 2020 }, drain: 1.1 },
  { id: 'satellite', cost: 14, devPoints: 2, expected: { budget: 2031, mid: 2028, flagship: 2026 }, drain: 1.03 },
  { id: 'aiCore', cost: 18, devPoints: 3, expected: { budget: 2030, mid: 2027, flagship: 2025 }, drain: 1.05 },
  { id: 'underCam', cost: 20, devPoints: 3, expected: { budget: 2036, mid: 2032, flagship: 2030 }, drain: 1.0 },
  // Solid-state cells: the battery lasts longer (drain below 1).
  { id: 'solidState', cost: 26, devPoints: 3, expected: { budget: 2040, mid: 2036, flagship: 2034 }, drain: 0.82 },
  { id: 'holo', cost: 45, devPoints: 5, expected: { budget: 2052, mid: 2046, flagship: 2042 }, drain: 1.12 },
];

export function featureById(id: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.id === id);
}
