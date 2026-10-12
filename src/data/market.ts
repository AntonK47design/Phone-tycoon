// Market content: segments, review outlets, competitor line-up (GDD §7, §12).

export type Segment = 'budget' | 'mid' | 'flagship';

export interface SegmentDef {
  id: Segment;
  /** Share of the tech expectation this segment expects (σ_s). */
  sigma: number;
  /** Price anchor in 2007 $. */
  anchor: number;
  /** Price elasticity ε_s. */
  elasticity: number;
  /** Design weight multiplier. */
  alphaMul: number;
  /** Sweet-spot display size offset vs. flagship expectation. */
  sizeOffset: number;
}

export const SEGMENTS: Record<Segment, SegmentDef> = {
  budget: { id: 'budget', sigma: 0.35, anchor: 149, elasticity: 2.2, alphaMul: 0.75, sizeOffset: -0.3 },
  mid: { id: 'mid', sigma: 0.6, anchor: 299, elasticity: 1.6, alphaMul: 1.0, sizeOffset: -0.15 },
  flagship: { id: 'flagship', sigma: 1.0, anchor: 599, elasticity: 1.1, alphaMul: 1.125, sizeOffset: 0 },
};

/** Segment share of total market by year (linear interpolation between rows). */
export const SEGMENT_SHARES: { year: number; budget: number; mid: number; flagship: number }[] = [
  { year: 2007, budget: 0.45, mid: 0.35, flagship: 0.2 },
  { year: 2011, budget: 0.42, mid: 0.33, flagship: 0.2 },
  { year: 2017, budget: 0.38, mid: 0.32, flagship: 0.2 },
  { year: 2030, budget: 0.3, mid: 0.3, flagship: 0.2 },
];

/** Attractiveness of the rest of the market (no-name / feature phones), A_0. */
export function restMarketAttractiveness(year: number): number {
  const t = Math.min(1, Math.max(0, (year - 2007) / 8));
  return 1.8 + (0.4 - 1.8) * t;
}

/** Distribution reach ρ in the garage (online shop only). */
export const GARAGE_REACH = 0.0025;

export interface OutletDef {
  id: string;
  name: string;
  bias: number;
  /** >0 favours design, <0 favours tech. */
  focus: number;
}

export const OUTLETS: OutletDef[] = [
  { id: 'pocketbyte', name: 'Pocket Byte', bias: 0.1, focus: -1 },
  { id: 'gadgetwelt', name: 'Gadgetwelt', bias: -0.2, focus: 1 },
  { id: 'techblitz', name: 'TechBlitz', bias: 0.2, focus: 0 },
];

export interface CompetitorDef {
  id: string;
  name: string;
  color: string;
  brand: number;
  reach: number;
  /** Tech aggressiveness τ. */
  tau: number;
  designBias: number;
  segments: Segment[];
}

export const COMPETITORS: CompetitorDef[] = [
  { id: 'tellmark', name: 'Tellmark', color: '#7f8c9a', brand: 85, reach: 1.0, tau: 0.75, designBias: -0.6, segments: ['budget', 'mid'] },
  { id: 'novaphone', name: 'Novaphone', color: '#e9e9e9', brand: 40, reach: 0.4, tau: 1.1, designBias: 0.8, segments: ['flagship'] },
  { id: 'kitecell', name: 'Kitecell', color: '#f2a03d', brand: 30, reach: 0.6, tau: 0.9, designBias: -0.4, segments: ['budget'] },
  { id: 'orbis', name: 'Orbis Mobile', color: '#4f7de0', brand: 50, reach: 0.8, tau: 0.95, designBias: 0, segments: ['budget', 'mid', 'flagship'] },
  { id: 'sunpeak', name: 'Sunpeak', color: '#f2d24b', brand: 25, reach: 0.4, tau: 1.0, designBias: 0, segments: ['mid', 'flagship'] },
  { id: 'lumo', name: 'Lumo', color: '#d36bd8', brand: 20, reach: 0.3, tau: 0.9, designBias: 1.0, segments: ['mid', 'flagship'] },
  { id: 'vantor', name: 'Vantor', color: '#47d18a', brand: 15, reach: 0.3, tau: 1.05, designBias: -0.2, segments: ['mid'] },
  { id: 'pebblecom', name: 'Pebblecom', color: '#41c3d6', brand: 35, reach: 0.5, tau: 0.95, designBias: -0.2, segments: ['budget', 'mid'] },
];
