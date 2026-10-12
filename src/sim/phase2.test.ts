import { describe, expect, it } from 'vitest';
import { OEM_LEAD_DAYS } from '../data/components';
import { RESEARCH } from '../data/research';
import { advanceDay, applyAction, creditAvailable, forecast, newGame } from './game';
import { applyOffline, OFFLINE_MAX_DAYS } from './offline';
import { availableParts, researchCost, researchStatus } from './research';
import { deserialize } from './save/save';
import type { GameState } from './state';

/** A company that has launched once and rented the office. */
function officeGame(): GameState {
  const s = newGame(3);
  applyAction(s, { type: 'setDraft', patch: { colorId: 'graphite' } });
  applyAction(s, { type: 'launch' });
  s.officeReady = true;
  s.company.cash = 200_000;
  expect(applyAction(s, { type: 'rentOffice' })[0].type).toBe('officeRented');
  return s;
}

function devAndLaunch(s: GameState, opts = {}) {
  applyAction(s, { type: 'startDev' });
  for (let i = 0; i < 60 && !s.dev?.done; i++) advanceDay(s);
  return applyAction(s, { type: 'launch', options: { batch: 300, ...opts } });
}

describe('office & research', () => {
  it('research costs RP and money and unlocks a new part generation', () => {
    const s = officeGame();
    const node = RESEARCH.find((n) => n.id === 'chip-2008')!;
    expect(researchStatus(s, node)).toBe('available'); // one year early = pioneer
    const cash = s.company.cash;
    expect(applyAction(s, { type: 'startResearch', id: 'chip-2008' })[0].type).toBe('researchStarted');
    expect(s.company.cash).toBeLessThan(cash);
    expect(researchCost(node, 2007).rp).toBeGreaterThan(node.rp); // pioneer surcharge
    for (let i = 0; i < 400 && s.research.current; i++) advanceDay(s);
    expect(s.research.done).toContain('chip-2008');
    expect(availableParts(s, 'chip').some((p) => p.gen === 2008)).toBe(true);
  });

  it('later generations are locked until their prerequisite is researched', () => {
    const s = officeGame();
    expect(researchStatus(s, RESEARCH.find((n) => n.id === 'chip-2009')!)).toBe('locked');
  });
});

describe('production', () => {
  it('launches with a batch, sells from stock and re-orders arrive after the lead time', () => {
    const s = officeGame();
    const ev = devAndLaunch(s);
    expect(ev[0].type).toBe('launched');
    const p = s.products[s.products.length - 1];
    expect(p.madeToOrder).toBe(false);
    const stock0 = p.stock;
    for (let i = 0; i < 7; i++) advanceDay(s);
    expect(p.stock).toBeLessThan(stock0);
    applyAction(s, { type: 'orderBatch', productId: p.id, units: 500 });
    const before = p.stock;
    for (let i = 0; i < OEM_LEAD_DAYS - 1; i++) advanceDay(s);
    expect(p.orders).toHaveLength(1);
    advanceDay(s);
    expect(p.orders).toHaveLength(0);
    expect(p.stock).toBeGreaterThan(before - 200);
  });

  it('a sold-out phone stays on sale', () => {
    const s = officeGame();
    devAndLaunch(s, { batch: 100 });
    const p = s.products[s.products.length - 1];
    for (let i = 0; i < 70; i++) advanceDay(s);
    expect(p.stock).toBe(0);
    expect(p.active).toBe(true);
  });

  it('the bank always finances a minimum batch', () => {
    const s = officeGame();
    applyAction(s, { type: 'startDev' });
    for (let i = 0; i < 60 && !s.dev?.done; i++) advanceDay(s);
    s.company.cash = 0;
    s.company.debt = 10_000_000;
    expect(creditAvailable(s)).toBe(0);
    const ev = applyAction(s, { type: 'launch', options: { batch: 100 } });
    expect(ev[0].type).toBe('launched');
    expect(s.company.debt).toBeGreaterThan(10_000_000);
  });

  it('marketing creates hype that shows in the forecast', () => {
    const s = officeGame();
    s.research.done.push('marketing');
    const quiet = forecast(s, s.draft, { marketing: 0 });
    const loud = forecast(s, s.draft, { marketing: 20_000 });
    expect(loud.hype).toBeGreaterThan(20);
    expect(loud.weeklyUnits).toBeGreaterThan(quiet.weeklyUnits);
  });
});

describe('scoring with features', () => {
  it('missing an expected feature costs review points', () => {
    const s = officeGame();
    s.day = 364 * 2; // 2009: 3G expected for mid-range
    applyAction(s, { type: 'setDraft', patch: {} });
    const f = forecast(s);
    expect(f.features.missing).toContain('net3g');
  });
});

describe('saves & offline', () => {
  it('migrates a v1 save to v2', () => {
    const v1 = newGame(5) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    delete v1.draft.parts;
    delete v1.draft.features;
    delete v1.research;
    delete v1.history;
    delete v1.week;
    delete v1.company.debt;
    v1.cashHistory = [1, 2, 3];
    v1.version = 1;
    const out = deserialize(JSON.stringify({ version: 1, savedAt: 0, state: v1 })).state;
    expect(out.version).toBe(2);
    expect(out.draft.parts.chip).toBe('chip-2007-std');
    expect(out.research.done).toEqual([]);
    expect(out.history.cash).toEqual([1, 2, 3]);
    expect(out.company.debt).toBe(0);
  });

  it('offline progress moves the calendar at most four weeks', () => {
    const s = officeGame();
    const day0 = s.day;
    const report = applyOffline(s, 10 * 3600)!;
    expect(report.days).toBe(OFFLINE_MAX_DAYS);
    expect(s.day - day0).toBe(OFFLINE_MAX_DAYS);
    expect(applyOffline(s, 10)).toBeNull();
  });

  it('offline credit finishes research the calendar alone would not', () => {
    const s = officeGame();
    applyAction(s, { type: 'startResearch', id: 'marketing' });
    const report = applyOffline(s, 8 * 3600)!;
    expect(report.researchDone).toContain('marketing');
  });
});
