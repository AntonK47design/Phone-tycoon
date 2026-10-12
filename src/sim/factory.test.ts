import { describe, expect, it } from 'vitest';
import { lineCapacityDay, lineScrap } from '../data/factory';
import { unitCost } from './economy/market';
import { autoAssign, lineRate, lineScrapRate, stockTotal } from './factory';
import { advanceDay, applyAction, currentReview, newGame } from './game';
import { deserialize } from './save/save';
import type { GameState } from './state';
import { yearOf } from './time';

function factoryGame(): GameState {
  const s = newGame(11);
  applyAction(s, { type: 'setDraft', patch: { colorId: 'lime' } });
  applyAction(s, { type: 'launch' });
  s.officeReady = true;
  s.company.cash = 5_000_000;
  applyAction(s, { type: 'rentOffice' });
  s.phase3Ready = true;
  // A stock-based phone to build.
  applyAction(s, { type: 'startDev' });
  s.dev!.done = true;
  applyAction(s, { type: 'launch', options: { batch: 100 } });
  return s;
}

describe('factory (GDD §9)', () => {
  it('needs the phase-3 gate; building it enters phase 3 with one line', () => {
    const s = factoryGame();
    s.phase3Ready = false;
    expect(applyAction(s, { type: 'buildFactory' })[0]).toMatchObject({ type: 'rejected' });
    s.phase3Ready = true;
    expect(applyAction(s, { type: 'buildFactory' })[0].type).toBe('factoryBuilt');
    expect(s.phase).toBe(3);
    expect(s.factory.lines).toHaveLength(1);
    // The newest stock phone is on the line right away.
    expect(s.factory.lines[0].productId).toBe(s.products[s.products.length - 1].id);
  });

  it('own lines are cheaper than the contract manufacturer and get cheaper with level', () => {
    const s = factoryGame();
    const d = s.products[1].design;
    const y = yearOf(s.day);
    expect(unitCost(d, y, 'factory', 1)).toBeLessThan(unitCost(d, y, 'oem'));
    expect(unitCost(d, y, 'factory', 5)).toBeLessThan(unitCost(d, y, 'factory', 1));
    expect(lineCapacityDay(4)).toBeCloseTo(60 * 8);
    expect(lineScrap(1)).toBeCloseTo(0.04);
  });

  it('lines fill stock up to the target and stop there', () => {
    const s = factoryGame();
    applyAction(s, { type: 'buildFactory' });
    const p = s.products[s.products.length - 1];
    p.stock = 0;
    const cash = s.company.cash;
    for (let i = 0; i < 70; i++) advanceDay(s);
    expect(s.factory.produced).toBeGreaterThan(0);
    expect(s.company.cash).not.toBe(cash);
    // Never piles up far beyond the target.
    const weekly = Math.max(p.lastWeekDemand, 1);
    expect(p.stock).toBeLessThan(weekly * (s.factory.targetWeeks + 3) + lineRate(s, s.factory.lines[0]) * 2);
  });

  it('tempo trades speed for scrap; scrap costs review points as returns', () => {
    const s = factoryGame();
    applyAction(s, { type: 'buildFactory' });
    const line = s.factory.lines[0];
    applyAction(s, { type: 'setTempo', tempo: 'speed' });
    const fast = { rate: lineRate(s, line), scrap: lineScrapRate(s, line) };
    applyAction(s, { type: 'setTempo', tempo: 'quality' });
    expect(lineRate(s, line)).toBeLessThan(fast.rate);
    expect(lineScrapRate(s, line)).toBeLessThan(fast.scrap);
    const p = s.products[s.products.length - 1];
    const before = currentReview(p, yearOf(s.day));
    p.defectRate = 0.04;
    expect(currentReview(p, yearOf(s.day))).toBeCloseTo(before - 0.2, 5);
  });

  it('a launch takes an idle line, else the weakest seller; batch 0 is allowed with a factory', () => {
    const s = factoryGame();
    applyAction(s, { type: 'buildFactory' });
    s.products.forEach((p) => (p.lastWeekDemand = 100));
    applyAction(s, { type: 'startDev' });
    s.dev!.done = true;
    const ev = applyAction(s, { type: 'launch', options: { batch: 0 } });
    const launched = ev.find((e) => e.type === 'launched');
    expect(launched).toBeTruthy();
    const newest = s.products[s.products.length - 1];
    expect(newest.stock).toBe(0);
    expect(s.factory.lines[0].productId).toBe(newest.id);
    expect(autoAssign(s, newest.id)).toBe(s.factory.lines[0].id);
  });

  it('upgrades, more lines, warehouse and overflow', () => {
    const s = factoryGame();
    applyAction(s, { type: 'buildFactory' });
    s.company.cash = 50_000_000;
    applyAction(s, { type: 'upgradeLine', id: s.factory.lines[0].id });
    expect(s.factory.lines[0].level).toBe(2);
    applyAction(s, { type: 'addLine' });
    expect(applyAction(s, { type: 'addLine' })[0]).toMatchObject({ type: 'rejected' }); // small factory: 2 lines
    applyAction(s, { type: 'growFactory' });
    expect(applyAction(s, { type: 'addLine' })[0].type).toBe('lineAdded');
    applyAction(s, { type: 'upgradeWarehouse' });
    expect(s.factory.warehouse).toBe(1);
    expect(stockTotal(s)).toBeGreaterThanOrEqual(0);
  });

  it('migrates a v4 save', () => {
    const s = factoryGame() as unknown as Record<string, unknown>;
    delete s.factory;
    delete s.phase4Ready;
    const out = deserialize(JSON.stringify({ version: 4, savedAt: 0, state: s }));
    expect(out.state.factory.size).toBe(0);
    expect(out.state.phase4Ready).toBe(false);
  });
});
