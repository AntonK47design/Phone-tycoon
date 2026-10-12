// Own factory (GDD §9, Phase 3). Constants only; rules live in sim/factory.ts.

export type Tempo = 'quality' | 'normal' | 'speed';

/** Tempo setting: output multiplier and scrap multiplier. */
export const TEMPOS: Record<Tempo, { speed: number; scrap: number }> = {
  quality: { speed: 0.8, scrap: 0.5 },
  normal: { speed: 1, scrap: 1 },
  speed: { speed: 1.3, scrap: 2 },
};

export const MAX_LINE_LEVEL = 10;

/** Factory sizes: max lines and price (2007 $). Size 1 comes with the first line. */
export const FACTORY_SIZES = [
  { size: 1, lines: 2, price: 400_000 },
  { size: 2, lines: 4, price: 1_500_000 },
  { size: 3, lines: 8, price: 8_000_000 },
];

/**
 * Units per day of one line at level L: 60 · L^1.5 (GDD §9.2 had 300; scaled to the
 * game's market volumes: L1 ≈ 420/week, L5 ≈ 4 700/week, L10 ≈ 13 300/week).
 */
export function lineCapacityDay(level: number): number {
  return 60 * Math.pow(level, 1.5);
}

/** Base scrap rate: 4 % − 0.35 % per level above 1. */
export function lineScrap(level: number): number {
  return Math.max(0.005, 0.04 - 0.0035 * (level - 1));
}

/** Assembly cost per unit on an own line: 12 · 0.85^(L−1). */
export function lineAssembly(level: number): number {
  return 12 * Math.pow(0.85, level - 1);
}

/** Upgrading a line from `level` to `level + 1` (2007 $). */
export function lineUpgradePrice(level: number): number {
  return 50_000 * Math.pow(2.2, level - 1);
}

/** Building an extra line (2007 $). */
export const NEW_LINE_PRICE = 150_000;

/** Warehouse: 10 000 · 3^level units; upgrade price per level (2007 $). */
export function warehouseCapacity(level: number): number {
  return 10_000 * Math.pow(3, level);
}
export function warehouseUpgradePrice(level: number): number {
  return 80_000 * Math.pow(3, level);
}

/** Stock above warehouse capacity costs this share of unit cost per week (GDD §7.6). */
export const OVERFLOW_RATE = 0.01;
/** Weekly upkeep: share of everything invested in the factory. */
export const FACTORY_UPKEEP_RATE = 0.01;
/** Default stock target of the lines, in weeks of demand. */
export const DEFAULT_TARGET_WEEKS = 4;
/** Review penalty per scrap share that slips through as returns: 0.1 per 2 %. */
export const SCRAP_REVIEW_PENALTY = 5;
