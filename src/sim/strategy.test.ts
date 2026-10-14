// Guards the phone builder against a dominant strategy (the "budget label, flagship
// parts" exploit): the price decides the segment, and upgrades pay where buyers value them.

import { describe, expect, it } from 'vitest';
import { TECH_CATEGORIES } from '../data/components';
import { COLORS } from '../data/design';
import { expectedDisplaySize } from '../data/eras';
import { SEGMENTS, type Segment } from '../data/market';
import { FEATURES, featureExpected, type Tier } from '../data/parts';
import { RESEARCH } from '../data/research';
import { applyAction, forecast, newGame } from './game';
import { availableMaterials, availableSizes } from './research';
import { isTrendColor, segmentForPrice } from './scoring/score';
import type { GameState } from './state';

function company(year: number, brand: number): GameState {
  const s = newGame(3);
  applyAction(s, { type: 'setTutorial', step: 'done' });
  applyAction(s, { type: 'launch' });
  s.officeReady = true;
  s.company.cash = 1e8;
  applyAction(s, { type: 'rentOffice' });
  s.day = (year - 2007) * 364;
  s.company.brand = brand;
  s.research.done = RESEARCH.filter((n) => n.year <= year && !n.unlock.frontier).map((n) => n.id);
  s.unlockedColors = COLORS.map((c) => c.id);
  return s;
}

/** A sensibly built phone for a positioning and part tier; returns weekly profit. */
function build(s: GameState, year: number, target: Segment, tier: Tier) {
  applyAction(s, { type: 'setDraft', patch: { segment: target } });
  const d = s.draft;
  for (const c of TECH_CATEGORIES) d.parts[c] = `${c}-${year}-${tier}`;
  d.features = FEATURES.filter((f) => featureExpected(f, target) <= year).map((f) => f.id);
  const mats = availableMaterials(s);
  d.materialId = target === 'budget' ? 'plastic' : mats[mats.length - 1];
  const sweet = expectedDisplaySize(year) + SEGMENTS[target].sizeOffset;
  d.displaySize = availableSizes(s).reduce((a, b) => (Math.abs(b - sweet) < Math.abs(a - sweet) ? b : a));
  d.colorId = s.unlockedColors.find((c) => isTrendColor(c, year)) ?? d.colorId;
  applyAction(s, { type: 'setDraft', patch: {} });
  const f = forecast(s, s.draft);
  return { segment: s.draft.segment, price: s.draft.price, profit: f.weeklyUnits * f.margin };
}

describe('builder strategy (no dominant choice)', () => {
  it('the shelf price decides the segment', () => {
    const s = company(2014, 50);
    applyAction(s, { type: 'setDraft', patch: { segment: 'budget' } });
    expect(s.draft.segment).toBe('budget');
    // Budget label, flagship price: sold to flagship buyers.
    applyAction(s, { type: 'setDraft', patch: { customPrice: 899 } });
    expect(s.draft.segment).toBe('flagship');
    expect(s.draft.target).toBe('budget');
    // Picking a positioning drops the custom price again.
    applyAction(s, { type: 'setDraft', patch: { segment: 'mid' } });
    expect(s.draft.customPrice).toBeNull();
    expect(s.draft.segment).toBe('mid');
    expect(segmentForPrice(99, 2014, 'flagship')).toBe('budget');
  });

  for (const [year, brand] of [
    [2012, 40],
    [2020, 75],
  ] as const) {
    it(`${year}, brand ${brand}: upgrades pay where buyers value them`, () => {
      const s = company(year, brand);
      const p = (seg: Segment, tier: Tier) => build(s, year, seg, tier);
      // Flagship buyers reward the best parts…
      expect(p('flagship', 'pro').profit).toBeGreaterThan(1.5 * p('flagship', 'std').profit);
      // …budget buyers don't pay for them: pro parts push the price out of the budget range.
      const budgetPro = p('budget', 'pro');
      expect(budgetPro.segment).not.toBe('budget');
      expect(p('budget', 'lite').profit).toBeGreaterThan(budgetPro.profit);
      // Mid-range: standard parts beat both extremes.
      expect(p('mid', 'std').profit).toBeGreaterThan(p('mid', 'lite').profit);
      // The old exploit is never the best plan; a well-built flagship beats any budget phone.
      const bestBudget = Math.max(...(['lite', 'std', 'pro'] as Tier[]).map((t) => p('budget', t).profit));
      expect(p('flagship', 'pro').profit).toBeGreaterThan(bestBudget);
    });
  }
});
