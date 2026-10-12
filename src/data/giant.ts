// Tech giant (GDD §15, Phase 5): campus, own chip, own OS, side products, acquisitions.

export const CAMPUS_LEVELS = [
  { level: 1, price: 50_000_000, bonus: 0.1 },
  { level: 2, price: 150_000_000, bonus: 0.2 },
  { level: 3, price: 400_000_000, bonus: 0.3 },
];
/** Weekly campus upkeep as a share of its price. */
export const CAMPUS_UPKEEP = 0.004;

/** Chip project n: money (2007 $) and tech points. */
export function chipProjectCost(level: number): { money: number; points: number } {
  return { money: 20_000_000 * Math.pow(1.5, level), points: Math.round(400 * Math.pow(1.3, level)) };
}
/** OS project n: money and software points. */
export function osProjectCost(level: number): { money: number; points: number } {
  return { money: 30_000_000 * Math.pow(1.4, level), points: Math.round(500 * Math.pow(1.3, level)) };
}
/** Own chip TI as share of the flagship expectation: 0.9 + 0.05·level (+0.1 from campus 2), max 1.4. */
export function chipRatio(level: number, campus: number): number {
  return Math.min(1.4, 0.9 + 0.05 * level + (campus >= 2 ? 0.1 : 0));
}
/** Licence fees per unit (2007 $). */
export const CHIP_FEE = 1.5;
export const OS_FEE = 1;
/** Ecosystem size where the app store is half as good as it gets. */
export const OS_HALF_BASE = 3_000_000;
/** Installed base decays with a ~3-year life. */
export const OS_BASE_LIFE_WEEKS = 156;

export type SideKind = 'watch' | 'earbuds' | 'tablet';
export const SIDE_KINDS: SideKind[] = ['watch', 'earbuds', 'tablet'];
export const SIDE_PRODUCTS: Record<SideKind, { year: number; anchor: number; attach: number; dev: number }> = {
  watch: { year: 2015, anchor: 249, attach: 0.08, dev: 3_000_000 },
  earbuds: { year: 2016, anchor: 149, attach: 0.15, dev: 1_500_000 },
  tablet: { year: 2010, anchor: 399, attach: 0.05, dev: 4_000_000 },
};
export const SIDE_TIER_BONUS = { lite: 0, std: 1.2, pro: 2.2 } as const;
export const SIDE_PRICE = { value: 0.8, normal: 1, premium: 1.3 } as const;
export type SidePrice = keyof typeof SIDE_PRICE;
/** Share of side-product revenue kept as profit. */
export const SIDE_MARGIN = 0.35;
