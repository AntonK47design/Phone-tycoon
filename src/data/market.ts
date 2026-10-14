// Market content: segments, review outlets, competitor line-up (GDD §7, §12).

export type Segment = 'budget' | 'mid' | 'flagship' | 'senior' | 'gaming';

/** All segments; senior and gaming open with the expansion (phase 4). */
export const ALL_SEGMENTS: Segment[] = ['budget', 'mid', 'flagship', 'senior', 'gaming'];
export const BASE_SEGMENTS: Segment[] = ['budget', 'mid', 'flagship'];

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
  /**
   * How far buyers reward tech above what they need (rating points). Budget buyers stop
   * caring soon; flagship and gaming buyers reward every step (Infinity = no cap).
   */
  headroom: number;
  /** How steeply the fair price rises with the rating: (P/7)^slope. */
  valueSlope: number;
  /** Niche audiences (senior, gaming) only buy within this price range around the anchor. */
  nicheBand?: [number, number];
}

export const SEGMENTS: Record<Segment, SegmentDef> = {
  budget: { id: 'budget', sigma: 0.35, anchor: 149, elasticity: 2.2, alphaMul: 0.75, sizeOffset: -0.3, headroom: 1.2, valueSlope: 1.2 },
  mid: { id: 'mid', sigma: 0.6, anchor: 299, elasticity: 1.6, alphaMul: 1.0, sizeOffset: -0.15, headroom: 1.5, valueSlope: 1.7 },
  flagship: { id: 'flagship', sigma: 0.9, anchor: 599, elasticity: 1.1, alphaMul: 1.125, sizeOffset: 0, headroom: Infinity, valueSlope: 2.0 },
  // Big, simple, long battery; price-aware.
  senior: { id: 'senior', sigma: 0.35, anchor: 199, elasticity: 1.8, alphaMul: 0.8, sizeOffset: 0.2, headroom: 1.2, valueSlope: 1.2, nicheBand: [0.65, 1.5] },
  // Fast chips, big screens, design matters less.
  gaming: { id: 'gaming', sigma: 0.95, anchor: 699, elasticity: 1.2, alphaMul: 0.8, sizeOffset: 0.1, headroom: Infinity, valueSlope: 2.0, nicheBand: [0.7, 3] },
};

/** The price ladder: a phone's shelf price decides which of these it competes in. */
export const PRICE_LADDER: Segment[] = ['budget', 'mid', 'flagship'];

/** Segment share of total market by year (linear interpolation between rows). */
export const SEGMENT_SHARES: ({ year: number } & Record<Segment, number>)[] = [
  { year: 2007, budget: 0.45, mid: 0.35, flagship: 0.2, senior: 0.04, gaming: 0.0 },
  { year: 2011, budget: 0.42, mid: 0.33, flagship: 0.2, senior: 0.05, gaming: 0.01 },
  { year: 2017, budget: 0.38, mid: 0.32, flagship: 0.2, senior: 0.05, gaming: 0.04 },
  { year: 2030, budget: 0.3, mid: 0.3, flagship: 0.2, senior: 0.06, gaming: 0.07 },
];

/** Attractiveness of the rest of the market (no-name / feature phones), A_0. */
export function restMarketAttractiveness(year: number): number {
  const t = Math.min(1, Math.max(0, (year - 2007) / 8));
  return 1.8 + (1.0 - 1.8) * t;
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
  /** Start brand. */
  brand: number;
  /** Distribution reach ρ by year (linear between keyframes). */
  reach: [number, number][];
  /** Tech aggressiveness τ by year. */
  tau: [number, number][];
  designBias: number;
  segments: Segment[];
  /** Weeks between launches. */
  cadence: number;
  /** Price strategy: shelf price vs. fair price. */
  priceMul: number;
  /** Model name prefix ("Kite 4"). */
  model: string;
}

export const COMPETITORS: CompetitorDef[] = [
  // The old giant: sleeps through the touch era.
  { id: 'tellmark', name: 'Tellmark', color: '#7f8c9a', brand: 85, reach: [[2007, 1.0], [2014, 0.7]], tau: [[2007, 0.75], [2011, 0.62], [2015, 0.55]], designBias: -0.6, segments: ['budget', 'mid', 'senior'], cadence: 52, priceMul: 0.95, model: 'Tellmark T' },
  { id: 'novaphone', name: 'Novaphone', color: '#e9e9e9', brand: 40, reach: [[2007, 0.4], [2012, 1.0]], tau: [[2007, 1.1]], designBias: 0.8, segments: ['flagship'], cadence: 52, priceMul: 1.15, model: 'Novaphone ' },
  { id: 'kitecell', name: 'Kitecell', color: '#f2a03d', brand: 30, reach: [[2007, 0.6]], tau: [[2007, 0.9]], designBias: -0.4, segments: ['budget'], cadence: 20, priceMul: 0.85, model: 'Kite ' },
  { id: 'orbis', name: 'Orbis Mobile', color: '#4f7de0', brand: 50, reach: [[2007, 0.8]], tau: [[2007, 0.95]], designBias: 0, segments: ['budget', 'mid', 'flagship'], cadence: 26, priceMul: 1.0, model: 'Orbis ' },
  { id: 'sunpeak', name: 'Sunpeak', color: '#f2d24b', brand: 25, reach: [[2007, 0.4]], tau: [[2007, 1.0]], designBias: 0, segments: ['mid', 'flagship'], cadence: 39, priceMul: 1.0, model: 'Sunpeak Lens ' },
  { id: 'lumo', name: 'Lumo', color: '#d36bd8', brand: 20, reach: [[2007, 0.3]], tau: [[2007, 0.9]], designBias: 1.0, segments: ['mid', 'flagship'], cadence: 39, priceMul: 1.05, model: 'Lumo ' },
  // Gaming niche, strong from 2016.
  { id: 'vantor', name: 'Vantor', color: '#47d18a', brand: 15, reach: [[2007, 0.3], [2016, 0.6]], tau: [[2007, 1.0], [2016, 1.15]], designBias: -0.2, segments: ['mid', 'gaming'], cadence: 30, priceMul: 1.0, model: 'Vantor X' },
  { id: 'pebblecom', name: 'Pebblecom', color: '#41c3d6', brand: 35, reach: [[2007, 0.5]], tau: [[2007, 0.95]], designBias: -0.2, segments: ['budget', 'mid', 'senior'], cadence: 26, priceMul: 0.88, model: 'Pebble ' },
];

/** Value of a keyframe curve at `year`. */
export function curveAt(curve: [number, number][], year: number): number {
  if (year <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [y1, v1] = curve[i];
    if (year <= y1) {
      const [y0, v0] = curve[i - 1];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return curve[curve.length - 1][1];
}
