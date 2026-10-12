import { describe, expect, it } from 'vitest';
import { DAYS_PER_WEEK } from '../data/eras';
import { REGIONS } from '../data/regions';
import { rivalEntries, rivalModelReview, tickRivalsWeek } from './competitors';
import { choose, isActive, marketMultiplier, tickDirector } from './director';
import { advanceDay, applyAction, currentDemand, currentReview, newGame } from './game';
import { deserialize } from './save/save';
import type { GameState } from './state';
import { yearOf } from './time';
import { contractProblem, contractValue, regionFit, tickContracts } from './world';

function lateGame(): GameState {
  const s = newGame(21);
  applyAction(s, { type: 'setDraft', patch: { colorId: 'lime' } });
  applyAction(s, { type: 'launch' });
  s.officeReady = true;
  s.company.cash = 50_000_000;
  applyAction(s, { type: 'rentOffice' });
  s.phase3Ready = true;
  applyAction(s, { type: 'buildFactory' });
  applyAction(s, { type: 'startDev' });
  s.dev!.done = true;
  applyAction(s, { type: 'launch', options: { batch: 2000 } });
  s.company.cash = 50_000_000;
  return s;
}

describe('rivals (GDD §12)', () => {
  it('every rival starts with a model in each of its segments', () => {
    const s = newGame(3);
    expect(s.rivals).toHaveLength(8);
    for (const r of s.rivals) expect(r.models.length).toBeGreaterThan(0);
    expect(rivalEntries(s, 'mid').length).toBeGreaterThan(3);
  });

  it('rivals launch on their cadence and models age on the shelf', () => {
    const s = lateGame();
    const launches = s.rivals.reduce((a, r) => a + r.launches, 0);
    for (let i = 0; i < 120; i++) advanceDay(s);
    expect(s.rivals.reduce((a, r) => a + r.launches, 0)).toBeGreaterThan(launches);
    expect(s.news.some((n) => n.kind === 'rivalLaunch')).toBe(true);
    const m = s.rivals[0].models[0];
    expect(rivalModelReview(m, m.launchDay + 364)).toBeCloseTo(m.review - 1.14, 1);
  });

  it('the strongest rival answers a dominant player with a price cut', () => {
    const s = lateGame();
    const seg = new Map([['mid' as const, { player: 1000, comps: { orbis: 300, tellmark: 200, _rest: 100 } }]]);
    const ev = tickRivalsWeek(s, seg);
    expect(ev[0]).toMatchObject({ type: 'rivalPriceCut', rival: 'orbis' });
    expect(s.rivals.find((r) => r.id === 'orbis')!.priceCutUntil).toBeGreaterThan(s.day);
  });
});

describe('event director (GDD §13)', () => {
  it('recession shrinks the market; chip shortage asks for a decision', () => {
    const s = lateGame();
    s.events.active.push({ id: 'recession', start: s.day, until: s.day + 70 });
    expect(marketMultiplier(s)).toBeCloseTo(0.85);
    s.events.pending = { id: 'chipShortage', options: ['stockpile', 'wait'], deadline: s.day + 28, amount: 1000 };
    const cash = s.company.cash;
    choose(s, 'stockpile');
    expect(s.company.cash).toBe(cash - 1000);
    expect(isActive(s, 'chipShortage', 'stockpile')).toBe(true);
    expect(s.events.pending).toBeNull();
  });

  it('unanswered cards take the default option after the deadline', () => {
    const s = lateGame();
    const brand = s.company.brand;
    s.events.pending = { id: 'recall', options: ['recall', 'ignore'], deadline: s.day, target: String(s.products[1].id), amount: 1000 };
    tickDirector(s);
    expect(s.events.pending).toBeNull();
    expect(s.company.brand).toBeCloseTo(Math.max(0, brand - 15));
  });

  it('a long run fires a few events, never two big ones at once', () => {
    const s = lateGame();
    let maxBig = 0;
    for (let i = 0; i < 364 * 6; i++) {
      advanceDay(s);
      if (s.events.pending) applyAction(s, { type: 'eventChoice', option: s.events.pending.options[1] });
      const big = s.events.active.filter((e) => ['chipShortage', 'recession', 'cameraHype', 'tariff'].includes(e.id) && s.day < e.until).length;
      maxBig = Math.max(maxBig, big);
    }
    expect(s.news.some((n) => n.kind.startsWith('event.'))).toBe(true);
    expect(maxBig).toBeLessThanOrEqual(1);
  });
});

describe('regions, stores, contracts (GDD §14)', () => {
  it('entering a region needs the phase-4 gate and opens phase 4', () => {
    const s = lateGame();
    expect(applyAction(s, { type: 'enterRegion', region: 'europe' })[0]).toMatchObject({ type: 'rejected' });
    s.phase4Ready = true;
    const p = s.products[s.products.length - 1];
    const before = currentDemand(s, p);
    expect(applyAction(s, { type: 'enterRegion', region: 'europe' })[0].type).toBe('regionEntered');
    expect(s.phase).toBe(4);
    expect(currentDemand(s, p)).toBeGreaterThan(before);
    const brand = s.company.brand;
    applyAction(s, { type: 'openStore', region: 'europe' });
    expect(s.regions.stores.europe).toBe(1);
    expect(s.company.brand).toBeGreaterThan(brand);
  });

  it('regional taste fits between 0.7 and 1.3', () => {
    const s = lateGame();
    for (const r of REGIONS) {
      const fit = regionFit(s.products[1], r);
      expect(fit).toBeGreaterThanOrEqual(0.7);
      expect(fit).toBeLessThanOrEqual(1.3);
    }
  });

  it('contracts: offered in phase 4, delivered from stock, late deliveries pay less', () => {
    const s = lateGame();
    s.phase4Ready = true;
    applyAction(s, { type: 'enterRegion', region: 'latam' });
    tickContracts(s);
    expect(s.contracts.offers.length).toBe(1);
    const c = s.contracts.offers[0];
    const p = s.products[s.products.length - 1];
    c.segment = p.design.segment;
    c.minReview = 1;
    c.maxCost = p.unitCost + 1;
    p.stock = c.units + 10;
    const review = currentReview(p, yearOf(s.day));
    expect(contractProblem(s, c, p, review)).toBeNull();
    const onTime = contractValue(s, c, review);
    s.day = c.deadline + 2 * DAYS_PER_WEEK;
    expect(contractValue(s, c, review)).toBeCloseTo(onTime * 0.8, 0);
    const cash = s.company.cash;
    applyAction(s, { type: 'fulfilContract', id: c.id, productId: p.id });
    expect(s.company.cash).toBeGreaterThan(cash);
    expect(p.stock).toBe(10);
    expect(s.contracts.done).toBe(1);
  });

  it('senior and gaming segments open with the expansion', () => {
    const s = lateGame();
    applyAction(s, { type: 'setDraft', patch: { segment: 'gaming' } });
    expect(s.draft.segment).toBe('mid');
    s.phase4Ready = true;
    applyAction(s, { type: 'enterRegion', region: 'europe' });
    applyAction(s, { type: 'setDraft', patch: { segment: 'gaming' } });
    expect(s.draft.segment).toBe('gaming');
  });

  it('migrates a v5 save', () => {
    const s = lateGame() as unknown as Record<string, unknown>;
    for (const k of ['rivals', 'news', 'events', 'regions', 'contracts']) delete s[k];
    const out = deserialize(JSON.stringify({ version: 5, savedAt: 0, state: s }));
    expect(out.state.rivals).toHaveLength(8);
    expect(out.state.regions.entered).toEqual(['home']);
  });
});
