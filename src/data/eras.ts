// Expectation curves per epoch (GDD §5.1, §5.4, §8).

export const START_YEAR = 2007;
export const DAYS_PER_YEAR = 364;
export const DAYS_PER_WEEK = 7;

/** Flagship technology expectation (tech index). +30 % per year. */
export function expectedTech(year: number): number {
  return 100 * Math.pow(1.3, year - START_YEAR);
}

/** Expected flagship display diagonal in inches. */
export function expectedDisplaySize(year: number): number {
  return 3.5 + 3.2 * (1 - Math.exp(-(year - START_YEAR) / 5));
}

/** Expected body thickness in mm. */
export function expectedThickness(year: number): number {
  return 7.2 + 5.3 * Math.exp(-(year - START_YEAR) / 5);
}

/** Expected screen-to-body ratio (display area / front area). */
export function expectedScreenToBody(year: number): number {
  return 0.93 - 0.38 * Math.exp(-(year - START_YEAR) / 6);
}

/** Display aspect ratio (height / width) typical for the era. */
export function displayAspect(year: number): number {
  if (year < 2013) return 1.5;
  if (year < 2018) return 16 / 9;
  if (year < 2020) return 2.0;
  return 19.5 / 9;
}

/** Yearly inflation factor relative to 2007. */
export function inflation(year: number): number {
  return Math.pow(1.02, year - START_YEAR);
}

export interface EraDef {
  id: string;
  from: number;
  /** Design weight α of the epoch. */
  alpha: number;
}

export const ERAS: EraDef[] = [
  { id: 'touch', from: 2007, alpha: 0.4 },
  { id: 'apps', from: 2010, alpha: 0.4 },
  { id: 'phablet', from: 2013, alpha: 0.42 },
  { id: 'bezelless', from: 2016, alpha: 0.45 },
  { id: 'connected', from: 2019, alpha: 0.45 },
  { id: 'smartai', from: 2023, alpha: 0.45 },
  { id: 'rollable', from: 2028, alpha: 0.5 },
  { id: 'holo', from: 2035, alpha: 0.5 },
  { id: 'neural', from: 2045, alpha: 0.55 },
];

export function eraForYear(year: number): EraDef {
  let era = ERAS[0];
  for (const e of ERAS) if (year >= e.from) era = e;
  return era;
}

/** Trend colors per year (ids from colors.ts). Cycles after the table ends. */
const TREND_TABLE: Record<number, string[]> = {
  2007: ['graphite', 'snow', 'silver'],
  2008: ['graphite', 'snow', 'crimson'],
  2009: ['snow', 'ocean', 'midnight'],
  2010: ['snow', 'crimson', 'graphite'],
  2011: ['snow', 'coral', 'ocean'],
  2012: ['midnight', 'silver', 'mint'],
};

export function trendColors(year: number): string[] {
  const y = Math.floor(year);
  if (TREND_TABLE[y]) return TREND_TABLE[y];
  const keys = Object.keys(TREND_TABLE).map(Number);
  const k = keys[(y - START_YEAR) % keys.length];
  return TREND_TABLE[k];
}
