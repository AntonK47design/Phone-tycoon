import { describe, expect, it } from 'vitest';
import { expectedTech } from '../data/eras';
import { availableOs, availableParts, availableSegments, canMarket, researchCost } from './research';
import { researchById } from '../data/research';
import { advanceDay, applyAction, newGame, normalizeDraft } from './game';
import { ecosystemComplete, osScore, ownChipRatio, sideUnitsWeek } from './giant';
import { checkLegacy, legacyAfterPrestige, legacyPointsFor } from './legacy';
import { deserialize } from './save/save';
import { partTi } from './scoring/score';
import type { GameState } from './state';

function giantGame(): GameState {
  const s = newGame(31);
  applyAction(s, { type: 'setDraft', patch: { colorId: 'lime' } });
  applyAction(s, { type: 'launch' });
  s.officeReady = true;
  s.company.cash = 2_000_000_000;
  applyAction(s, { type: 'rentOffice' });
  for (const a of [...s.team.applicants]) applyAction(s, { type: 'hire', id: a.id });
  s.phase3Ready = s.phase4Ready = s.phase5Ready = true;
  s.day = 9 * 364; // 2016
  return s;
}

describe('content past 2024', () => {
  it('expectations keep the 2007–2024 curve, then slow down', () => {
    expect(expectedTech(2024) / expectedTech(2023)).toBeCloseTo(1.3);
    expect(expectedTech(2030) / expectedTech(2029)).toBeCloseTo(1.18);
    expect(expectedTech(2050) / expectedTech(2049)).toBeCloseTo(1.06);
  });

  it('frontier research is repeatable and boosts every part by 2 %', () => {
    const s = giantGame();
    const node = researchById('frontier')!;
    const c0 = researchCost(node, 2046, s).rp;
    s.research.frontier = 3;
    expect(researchCost(node, 2046, s).rp).toBeGreaterThan(c0);
    normalizeDraft(s, s.draft);
    expect(s.draft.techBoost).toBeCloseTo(Math.pow(1.02, 3));
  });
});

describe('tech giant (GDD §15)', () => {
  it('the campus needs the phase-5 gate and opens phase 5', () => {
    const s = giantGame();
    s.phase5Ready = false;
    expect(applyAction(s, { type: 'buildCampus' })[0]).toMatchObject({ type: 'rejected' });
    s.phase5Ready = true;
    expect(applyAction(s, { type: 'buildCampus' })[0].type).toBe('campusBuilt');
    expect(s.phase).toBe(5);
  });

  it('a chip project finishes with team output and adds the own chip to the editor', () => {
    const s = giantGame();
    applyAction(s, { type: 'buildCampus' });
    applyAction(s, { type: 'startChip' });
    s.clockStarted = true;
    for (let i = 0; i < 2000 && s.giant.chip.level === 0; i++) advanceDay(s);
    expect(s.giant.chip.level).toBe(1);
    expect(ownChipRatio(s)).toBeCloseTo(0.95);
    const own = availableParts(s, 'chip').find((p) => p.id === 'own-chip');
    expect(own).toBeTruthy();
    applyAction(s, { type: 'setDraft', patch: { part: { category: 'chip', id: 'own-chip' } } });
    expect(s.draft.ownChip?.ratio).toBeCloseTo(0.95);
    expect(partTi(s.draft, 'chip')).toBeGreaterThan(0);
  });

  it('own OS: quality plus an ecosystem that grows with the installed base', () => {
    const s = giantGame();
    applyAction(s, { type: 'buildCampus' });
    s.giant.os.level = 2;
    const small = osScore(s);
    s.giant.os.installed = 20_000_000;
    expect(osScore(s)).toBeGreaterThan(small);
    expect(availableOs(s)).toContain('own');
  });

  it('side products sell to fans; all three make an ecosystem', () => {
    const s = giantGame();
    applyAction(s, { type: 'buildCampus' });
    s.company.fans = 1_000_000;
    for (const kind of ['watch', 'earbuds', 'tablet'] as const) applyAction(s, { type: 'launchSide', kind, tier: 'pro', price: 'normal' });
    expect(sideUnitsWeek(s, 'watch')).toBeGreaterThan(0);
    expect(ecosystemComplete(s)).toBe(true);
  });

  it('weak rivals can be taken over and leave the market', () => {
    const s = giantGame();
    applyAction(s, { type: 'buildCampus' });
    const weak = s.rivals.find((r) => r.id === 'vantor')!;
    weak.brand = 10;
    weak.unitsLastYear = 1000;
    const ev = applyAction(s, { type: 'acquire', id: 'vantor' });
    expect(ev[0].type).toBe('acquired');
    expect(s.giant.acquired).toContain('vantor');
  });
});

describe('endgame & prestige (GDD §16)', () => {
  it('records and achievements are tracked', () => {
    const s = giantGame();
    const ev = checkLegacy(s, 2e9);
    expect(s.peakValuation).toBe(2e9);
    expect(s.achievements).toContain('firstPhone');
    expect(s.achievements).toContain('billion');
    expect(ev.some((e) => e.type === 'achievement')).toBe(true);
    expect(s.hall.some((h) => h.kind === 'peakValuation')).toBe(true);
  });

  it('prestige: legacy points from the peak valuation, bonuses bought, scenario applied', () => {
    const s = giantGame();
    checkLegacy(s, 4e10); // √(4e10/1e7) = 63 points
    expect(legacyPointsFor(s)).toBe(63);
    const legacy = legacyAfterPrestige(s, { cash: 2, research: 1 }, 'lateStart');
    expect(legacy.bonuses.cash).toBe(2);
    expect(legacy.points).toBe(63 - 2 - 4 - 2);
    expect(legacy.scenario).toBe('lateStart');
    expect(legacy.runs).toBe(1);
    const next = newGame(7, legacy);
    expect(next.company.cash).toBeCloseTo(2000 * 1.5);
    expect(Math.floor(next.day / 364)).toBe(9);
    expect(next.legacy.hall.length).toBeGreaterThan(0);
  });

  it('scenarios change the rules', () => {
    const s = giantGame();
    s.legacy.scenario = 'budgetOnly';
    expect(availableSegments(s)).not.toContain('mid');
    s.legacy.scenario = 'noMarketing';
    s.research.done.push('marketing');
    expect(canMarket(s)).toBe(false);
  });

  it('migrates a v6 save', () => {
    const s = giantGame() as unknown as Record<string, unknown>;
    for (const k of ['giant', 'phase5Ready', 'phase6Ready', 'hall', 'achievements', 'peakValuation', 'legacy']) delete s[k];
    const out = deserialize(JSON.stringify({ version: 6, savedAt: 0, state: s }));
    expect(out.state.giant.campus).toBe(0);
    expect(out.state.legacy.runs).toBe(0);
  });
});
