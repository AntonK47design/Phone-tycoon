// Research tree (GDD §11). Content as data; rules live in sim/research.ts.

import type { TechCategory } from './components';
import { inflation, START_YEAR } from './eras';
import { FIRST_GEN, LAST_GEN } from './parts';

export type Branch = TechCategory | 'body' | 'connectivity' | 'business';

export interface ResearchUnlock {
  partGen?: { category: TechCategory; gen: number };
  material?: string;
  finish?: string;
  feature?: string;
  shape?: string;
  sizes?: number[];
  /** Distribution reach (absolute value, highest wins). */
  reach?: number;
  marketing?: boolean;
  presentation?: number;
  os?: string;
}

export interface ResearchNode {
  id: string;
  branch: Branch;
  /** Release year: researchable from year − 1 (pioneer surcharge before release). */
  year: number;
  rp: number;
  money: number;
  requires: string[];
  unlock: ResearchUnlock;
}

const rpFor = (year: number, mul = 1) => Math.round(30 * Math.pow(1.25, year - START_YEAR) * mul);
const moneyFor = (rp: number, year: number) => Math.round((rp * 90 * inflation(year)) / 100) * 100;

function node(id: string, branch: Branch, year: number, unlock: ResearchUnlock, opts: { mul?: number; requires?: string[] } = {}): ResearchNode {
  const rp = rpFor(year, opts.mul);
  return { id, branch, year, rp, money: moneyFor(rp, year), requires: opts.requires ?? [], unlock };
}

function build(): ResearchNode[] {
  const out: ResearchNode[] = [];
  const cats: TechCategory[] = ['chip', 'display', 'battery', 'camera', 'storage', 'ram'];
  for (const category of cats) {
    for (let gen = FIRST_GEN + 1; gen <= LAST_GEN; gen++) {
      const prev = gen - 1 > FIRST_GEN ? [`${category}-${gen - 1}`] : [];
      out.push(node(`${category}-${gen}`, category, gen, { partGen: { category, gen } }, { requires: prev, mul: category === 'chip' || category === 'display' ? 1.2 : 0.9 }));
    }
  }
  // Body: materials, finishes, shapes, bigger screens.
  out.push(node('matte', 'body', 2007, { finish: 'matte' }, { mul: 0.6 }));
  out.push(node('aluminium', 'body', 2009, { material: 'aluminium' }, { mul: 1.4 }));
  out.push(node('blade', 'body', 2010, { shape: 'blade' }, { mul: 1.1, requires: ['aluminium'] }));
  out.push(node('glass', 'body', 2011, { material: 'glass' }, { mul: 1.4, requires: ['aluminium'] }));
  out.push(node('screen45', 'body', 2009, { sizes: [4.5] }, { mul: 0.9 }));
  out.push(node('screen50', 'body', 2011, { sizes: [5.0] }, { mul: 1, requires: ['screen45'] }));
  out.push(node('screen55', 'body', 2013, { sizes: [5.5] }, { mul: 1, requires: ['screen50'] }));
  out.push(node('screen60', 'body', 2015, { sizes: [6.0] }, { mul: 1, requires: ['screen55'] }));
  out.push(node('screen65', 'body', 2017, { sizes: [6.5] }, { mul: 1, requires: ['screen60'] }));
  out.push(node('screen68', 'body', 2020, { sizes: [6.8] }, { mul: 1, requires: ['screen65'] }));
  out.push(node('edge', 'body', 2014, { shape: 'edge' }, { mul: 1.2, requires: ['blade'] }));
  out.push(node('fullscreen', 'body', 2017, { shape: 'fullscreen' }, { mul: 1.3, requires: ['edge'] }));
  out.push(node('titanium', 'body', 2019, { material: 'titanium' }, { mul: 1.3, requires: ['glass'] }));
  // Connectivity & extras.
  out.push(node('net3g', 'connectivity', 2008, { feature: 'net3g' }, { mul: 1 }));
  out.push(node('gps', 'connectivity', 2008, { feature: 'gps' }, { mul: 0.8 }));
  out.push(node('frontCam', 'connectivity', 2009, { feature: 'frontCam' }, { mul: 0.8 }));
  out.push(node('net4g', 'connectivity', 2011, { feature: 'net4g' }, { mul: 1.3, requires: ['net3g'] }));
  out.push(node('fingerprint', 'connectivity', 2013, { feature: 'fingerprint' }, { mul: 1.2 }));
  out.push(node('waterproof', 'connectivity', 2015, { feature: 'waterproof' }, { mul: 1.1 }));
  out.push(node('wireless', 'connectivity', 2016, { feature: 'wireless' }, { mul: 1.1 }));
  out.push(node('faceUnlock', 'connectivity', 2017, { feature: 'faceUnlock' }, { mul: 1.2, requires: ['fingerprint'] }));
  out.push(node('net5g', 'connectivity', 2019, { feature: 'net5g' }, { mul: 1.3, requires: ['net4g'] }));
  // Business: reach, marketing, launch events, OS licence.
  out.push(node('marketing', 'business', 2007, { marketing: true }, { mul: 0.6 }));
  out.push(node('retail', 'business', 2007, { reach: 0.0035 }, { mul: 0.9 }));
  out.push(node('launchEvent', 'business', 2008, { presentation: 1 }, { mul: 1, requires: ['marketing'] }));
  out.push(node('carrier', 'business', 2009, { reach: 0.0055 }, { mul: 1.3, requires: ['retail'] }));
  out.push(node('mosaic', 'business', 2008, { os: 'mosaic' }, { mul: 1 }));
  out.push(node('bigStage', 'business', 2010, { presentation: 2 }, { mul: 1.2, requires: ['launchEvent'] }));
  out.push(node('national', 'business', 2010, { reach: 0.008 }, { mul: 1.5, requires: ['carrier'] }));
  return out;
}

export const RESEARCH: ResearchNode[] = build();
const BY_ID = new Map(RESEARCH.map((n) => [n.id, n]));

export function researchById(id: string): ResearchNode | undefined {
  return BY_ID.get(id);
}

export const BRANCHES: Branch[] = ['chip', 'display', 'battery', 'camera', 'storage', 'ram', 'body', 'connectivity', 'business'];
