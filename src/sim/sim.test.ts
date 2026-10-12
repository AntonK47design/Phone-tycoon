import { describe, expect, it } from 'vitest';
import { expectedDisplaySize, expectedScreenToBody, expectedTech, expectedThickness } from '../data/eras';
import { COLORS, DISPLAY_SIZES, SHAPES } from '../data/design';
import { runBot } from './bot';
import { marketSize } from './economy/market';
import { advanceDay, applyAction, forecast, newGame } from './game';
import { deserialize, SaveError, serialize } from './save/save';
import { ratingFromRatio, reviewEstimate } from './scoring/score';
import { createRng } from './rng';

describe('expectation curves (GDD §8.3)', () => {
  it('matches the reference table', () => {
    expect(expectedTech(2007)).toBeCloseTo(100, 5);
    expect(expectedTech(2010)).toBeCloseTo(219.7, 1);
    expect(expectedTech(2014)).toBeCloseTo(627.5, 0);
    expect(expectedDisplaySize(2007)).toBeCloseTo(3.5, 5);
    expect(expectedDisplaySize(2014)).toBeCloseTo(5.91, 1);
    expect(expectedThickness(2007)).toBeCloseTo(12.5, 5);
    expect(expectedScreenToBody(2007)).toBeCloseTo(0.55, 5);
  });

  it('category rating maps ratios as documented (GDD §5.2)', () => {
    expect(ratingFromRatio(1)).toBeCloseTo(7, 5);
    expect(ratingFromRatio(2)).toBeCloseTo(10, 5);
    expect(ratingFromRatio(0.5)).toBeCloseTo(4, 5);
    expect(ratingFromRatio(1 / 1.3)).toBeCloseTo(5.86, 1);
    expect(ratingFromRatio(0.01)).toBe(0);
  });

  it('market size follows the adoption curve (GDD §7.1)', () => {
    expect(marketSize(2007) / 1e6).toBeCloseTo(0.477, 2);
    expect(marketSize(2015) / 1e6).toBeCloseTo(9.83, 1);
  });
});

describe('scoring', () => {
  it('a 2007 phone ages badly by 2014', () => {
    const s = newGame(1);
    const d = { ...s.draft, colorId: 'graphite' };
    const now = reviewEstimate(d, 2007).score;
    const later = reviewEstimate(d, 2014).score;
    expect(now).toBeGreaterThan(6.5);
    expect(later).toBeLessThan(now - 2.5);
  });

  it('every tutorial combination lands between 6.5 and 8.0', () => {
    const s = newGame(7);
    for (const c of COLORS.filter((x) => x.starter)) {
      for (const sh of SHAPES) {
        for (const size of DISPLAY_SIZES) {
          const f = forecast(s, { ...s.draft, colorId: c.id, shapeId: sh.id, displaySize: size });
          expect(f.review).toBeGreaterThanOrEqual(6.5);
          expect(f.review).toBeLessThanOrEqual(8.0);
        }
      }
    }
  });

  it('trend colors and slim shapes score better than the alternative', () => {
    const s = newGame(3);
    const base = forecast(s, { ...s.draft, colorId: 'crimson', shapeId: 'round' });
    const trend = forecast(s, { ...s.draft, colorId: 'graphite', shapeId: 'round' });
    const slim = forecast(s, { ...s.draft, colorId: 'graphite', shapeId: 'slim' });
    expect(trend.design).toBeGreaterThan(base.design);
    expect(slim.design).toBeGreaterThan(trend.design);
    expect(slim.unitCost).toBeGreaterThan(trend.unitCost);
  });

  it('bigger displays trade battery rating for design', () => {
    const s = newGame(3);
    const small = forecast(s, { ...s.draft, displaySize: 3.0 });
    const big = forecast(s, { ...s.draft, displaySize: 4.0 });
    expect(big.techParts.categories.battery).toBeLessThan(small.techParts.categories.battery);
    expect(big.designParts.screenToBody).toBeGreaterThan(small.designParts.screenToBody);
  });
});

describe('game flow', () => {
  it('first launch works without time passing and rewards the player', () => {
    const s = newGame(11);
    applyAction(s, { type: 'setDraft', patch: { colorId: 'snow' } });
    const events = applyAction(s, { type: 'launch' });
    const launched = events.find((e) => e.type === 'launched');
    expect(launched).toBeTruthy();
    if (launched?.type !== 'launched') throw new Error();
    expect(launched.preorderRevenue).toBeGreaterThan(5_000);
    expect(launched.review.cards).toHaveLength(3);
    expect(s.day).toBe(0);
    expect(s.clockStarted).toBe(true);
    expect(events.some((e) => e.type === 'colorUnlocked' && e.colorId === 'midnight')).toBe(true);
  });

  it('development takes days and costs money after the tutorial', () => {
    const s = newGame(11);
    applyAction(s, { type: 'launch' });
    const cash = s.company.cash;
    const ev = applyAction(s, { type: 'startDev' });
    expect(ev[0].type).toBe('devStarted');
    expect(s.company.cash).toBeLessThan(cash);
    expect(applyAction(s, { type: 'launch' })[0]).toEqual({ type: 'rejected', reason: 'notReady' });
    let done = false;
    for (let i = 0; i < 20 && !done; i++) done = advanceDay(s).some((e) => e.type === 'devDone');
    expect(done).toBe(true);
    expect(applyAction(s, { type: 'launch' })[0].type).toBe('launched');
  });

  it('garage capacity caps weekly sales', () => {
    const s = newGame(5);
    applyAction(s, { type: 'launch' });
    s.company.brand = 100;
    for (let i = 0; i < 14; i++) advanceDay(s);
    expect(s.products[0].lastWeekUnits).toBeLessThanOrEqual(50);
  });
});

describe('determinism & saves', () => {
  it('same seed and actions produce identical state', { timeout: 60_000 }, () => {
    const a = runBot({ minutes: 15, seed: 99 }).final;
    const b = runBot({ minutes: 15, seed: 99 }).final;
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('rng is reproducible', () => {
    const r1 = createRng(5);
    const r2 = createRng(5);
    expect([r1.next(), r1.next()]).toEqual([r2.next(), r2.next()]);
  });

  it('save round-trips', () => {
    const s = runBot({ minutes: 10, seed: 4 }).final;
    const file = deserialize(serialize(s, 1234));
    expect(file.savedAt).toBe(1234);
    expect(file.state).toEqual(s);
  });

  it('applies migrations in order and rejects bad saves', () => {
    const old = JSON.stringify({ version: 1, savedAt: 0, state: { a: 1 } });
    const migrations = {
      1: (st: Record<string, unknown>) => ({ ...st, b: 2 }),
      2: (st: Record<string, unknown>) => ({ ...st, c: (st.b as number) + 1 }),
    };
    const out = deserialize(old, migrations, 3).state as unknown as Record<string, unknown>;
    expect(out).toMatchObject({ a: 1, b: 2, c: 3, version: 3 });
    expect(() => deserialize('{nope')).toThrow(SaveError);
    expect(() => deserialize(JSON.stringify({ version: 99, state: {} }))).toThrow(SaveError);
  });
});

describe('pacing (GDD §24.1)', () => {
  it('average bot reaches the office gate between 3 and 9 minutes and phase 3 between 20 and 45', () => {
    const r = runBot({ minutes: 45, seed: 42, sampleEveryMin: 15 });
    expect(r.officeReadyMin).not.toBeNull();
    expect(r.officeReadyMin!).toBeGreaterThan(3);
    expect(r.officeReadyMin!).toBeLessThan(9);
    expect(r.phase3Min).not.toBeNull();
    expect(r.phase3Min!).toBeGreaterThan(20);
    expect(r.phase3Min!).toBeLessThan(45);
  }, 60_000);

  it('a weak player never deadlocks: launches keep coming', () => {
    const r = runBot({ minutes: 60, seed: 8, profile: 'weak', sampleEveryMin: 20 });
    const launches = r.samples.map((x) => x.launches);
    expect(launches[launches.length - 1]).toBeGreaterThan(launches[1]);
  }, 60_000);

  it('average bot builds a factory and reaches the phase-4 gate between 75 and 120 minutes (M4)', () => {
    const r = runBot({ minutes: 120, seed: 42, sampleEveryMin: 30 });
    expect(r.factoryMin).not.toBeNull();
    expect(r.phase4Min).not.toBeNull();
    expect(r.phase4Min!).toBeGreaterThan(75);
    expect(r.phase4Min!).toBeLessThan(120);
  }, 180_000);
});
