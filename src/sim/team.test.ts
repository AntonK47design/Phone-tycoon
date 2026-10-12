import { describe, expect, it } from 'vitest';
import { advanceDay, applyAction, newGame } from './game';
import { claimCalendar, dailyProgress } from './daily';
import { deserialize, serialize } from './save/save';
import type { GameState } from './state';
import {
  devDaysFor,
  hireFee,
  moraleTarget,
  payroll,
  salary,
  seats,
  teamQuality,
  teamRates,
} from './team';

function officeGame(seed = 7): GameState {
  const s = newGame(seed);
  applyAction(s, { type: 'setDraft', patch: { colorId: 'lime' } });
  applyAction(s, { type: 'launch' });
  s.officeReady = true;
  s.company.cash = 500_000;
  applyAction(s, { type: 'rentOffice' });
  return s;
}

describe('team (GDD §10)', () => {
  it('renting the office opens level 1 with an applicant pool', () => {
    const s = officeGame();
    expect(s.team.office).toBe(1);
    expect(seats(s)).toBe(4);
    expect(s.team.applicants).toHaveLength(4);
    for (const a of s.team.applicants) {
      expect(a.skill).toBeGreaterThanOrEqual(1);
      expect(a.skill).toBeLessThanOrEqual(100);
    }
  });

  it('salary follows (300 + 25·skill) · inflation', () => {
    expect(salary({ skill: 40, trait: 'nightOwl' }, 2007)).toBeCloseTo(1300);
    expect(salary({ skill: 40, trait: 'frugal' }, 2007)).toBeCloseTo(1170);
    expect(salary({ skill: 40, trait: 'nightOwl' }, 2017)).toBeCloseTo(1300 * Math.pow(1.02, 10));
  });

  it('hiring costs two weekly salaries and respects the seat limit', () => {
    const s = officeGame();
    const a = s.team.applicants[0];
    const cash = s.company.cash;
    const fee = hireFee(a, 2007);
    const ev = applyAction(s, { type: 'hire', id: a.id });
    expect(ev[0].type).toBe('hired');
    expect(s.company.cash).toBeCloseTo(cash - fee);
    expect(s.team.staff).toHaveLength(1);
    expect(s.stats.hires).toBe(1);
    // Fill the office, then the next hire is refused.
    for (let i = 0; i < 6 && s.team.staff.length < 4; i++) {
      if (!s.team.applicants.length) s.team.poolDay = -999, advanceDay(s);
      applyAction(s, { type: 'hire', id: s.team.applicants[0].id });
    }
    expect(s.team.staff).toHaveLength(4);
    if (!s.team.applicants.length) {
      s.team.poolDay = -999;
      advanceDay(s);
    }
    const res = applyAction(s, { type: 'hire', id: s.team.applicants[0].id });
    expect(res[0]).toMatchObject({ type: 'rejected', reason: 'noSeats' });
  });

  it('staff speed up development and salaries are paid weekly', () => {
    const s = officeGame();
    const before = devDaysFor(s, s.draft);
    for (const a of [...s.team.applicants]) applyAction(s, { type: 'hire', id: a.id });
    expect(devDaysFor(s, s.draft)).toBeLessThan(before);
    expect(teamRates(s).design).toBeGreaterThan(2);
    // Week-end costs include the payroll.
    while (s.day % 7 !== 6) advanceDay(s);
    const pay = payroll(s);
    expect(pay).toBeGreaterThan(0);
    const cash = s.company.cash;
    s.products.forEach((p) => (p.active = false));
    advanceDay(s);
    expect(cash - s.company.cash).toBeGreaterThanOrEqual(pay);
  });

  it('training takes two weeks and raises skill by 8·(1 − skill/120)', () => {
    const s = officeGame();
    const a = s.team.applicants[0];
    applyAction(s, { type: 'hire', id: a.id });
    const e = s.team.staff[0];
    e.trait = 'nightOwl';
    e.skill = 30;
    applyAction(s, { type: 'train', id: e.id });
    expect(e.trainingUntil).toBe(s.day + 14);
    expect(teamRates(s).rp + teamRates(s).design + teamRates(s).tech + teamRates(s).software).toBeCloseTo(4 + 6);
    for (let i = 0; i < 14; i++) advanceDay(s);
    expect(e.trainingUntil).toBeNull();
    expect(e.skill).toBe(36);
    expect(s.stats.trainings).toBe(1);
  });

  it('a team below the era standard ships rougher phones', () => {
    const s = officeGame();
    s.day = 6 * 364; // 2013
    const alone = teamQuality(s);
    expect(alone).toBeLessThan(1);
    s.team.staff.push(
      ...[0, 1, 2].map((i) => ({ id: 100 + i, first: 'A', last: 'B', role: 'engineer' as const, skill: 85, morale: 70, trait: 'nightOwl' as const, hiredDay: 0, trainingUntil: null, look: 1 })),
    );
    expect(teamQuality(s)).toBeGreaterThan(alone);
  });

  it('morale drifts towards its target; a bonus lifts it', () => {
    const s = officeGame();
    applyAction(s, { type: 'hire', id: s.team.applicants[0].id });
    const e = s.team.staff[0];
    e.morale = 20;
    const target = moraleTarget(s);
    applyAction(s, { type: 'payBonus' });
    expect(moraleTarget(s)).toBeGreaterThan(target);
    expect(applyAction(s, { type: 'payBonus' })[0]).toMatchObject({ type: 'rejected' });
  });

  it('office upgrades add seats; lab and studio need office level 2', () => {
    const s = officeGame();
    s.company.cash = 10_000_000;
    expect(applyAction(s, { type: 'buildLab' })[0]).toMatchObject({ type: 'rejected' });
    applyAction(s, { type: 'upgradeOffice' });
    expect(seats(s)).toBe(8);
    const rp = teamRates(s).rp;
    applyAction(s, { type: 'buildLab' });
    expect(teamRates(s).rp).toBeCloseTo(rp * 1.25);
    applyAction(s, { type: 'buildStudio' });
    expect(s.team.studio).toBe(1);
  });

  it('migrates a v3 save', () => {
    const s = officeGame() as unknown as Record<string, unknown>;
    delete s.team;
    delete s.daily;
    delete s.cosmetics;
    const stats = s.stats as Record<string, unknown>;
    delete stats.hires;
    delete stats.trainings;
    delete stats.reorders;
    const out = deserialize(JSON.stringify({ version: 3, savedAt: 0, state: s }));
    expect(out.state.team.office).toBe(1);
    expect(out.state.daily.orders).toEqual([]);
    expect(out.state.stats.hires).toBe(0);
    expect(() => deserialize(serialize(out.state, 0))).not.toThrow();
  });
});

describe('daily calendar & mini orders (GDD §20.3–20.4)', () => {
  it('creates three deterministic orders per date', () => {
    const a = officeGame();
    const b = officeGame();
    applyAction(a, { type: 'dailySync', date: '2026-10-12' });
    applyAction(b, { type: 'dailySync', date: '2026-10-12' });
    expect(a.daily.orders).toHaveLength(3);
    expect(a.daily.orders.map((o) => o.kind)).toEqual(b.daily.orders.map((o) => o.kind));
    const kinds = a.daily.orders.map((o) => o.kind);
    applyAction(a, { type: 'dailySync', date: '2026-10-12' });
    expect(a.daily.orders.map((o) => o.kind)).toEqual(kinds);
  });

  it('tracks progress and pays out once', () => {
    const s = officeGame();
    applyAction(s, { type: 'dailySync', date: '2026-10-13' });
    const o = s.daily.orders[0];
    o.kind = 'hire';
    o.base = s.stats.hires;
    o.reward = { cash: 1000 };
    expect(dailyProgress(s, o)).toBe(0);
    const ev = applyAction(s, { type: 'hire', id: s.team.applicants[0].id });
    expect(ev.some((e) => e.type === 'dailyDone')).toBe(true);
    const cash = s.company.cash;
    applyAction(s, { type: 'claimDaily', index: 0 });
    expect(s.company.cash).toBe(cash + 1000);
    expect(applyAction(s, { type: 'claimDaily', index: 0 })[0]).toMatchObject({ type: 'rejected' });
  });

  it('calendar: one claim per date, day 7 unlocks the aurora finish, missed days do not reset', () => {
    const s = officeGame();
    expect(claimCalendar(s, '2026-10-01')[0].type).toBe('calendarClaimed');
    expect(claimCalendar(s, '2026-10-01')[0].type).toBe('rejected');
    // Skip a few real days: the streak pauses, it does not reset.
    claimCalendar(s, '2026-10-05');
    expect(s.daily.calendarStep).toBe(2);
    for (let d = 6; d <= 10; d++) claimCalendar(s, `2026-10-${String(d).padStart(2, '0')}`);
    expect(s.cosmetics).toContain('aurora');
    expect(s.daily.calendarStep).toBe(0);
    expect(s.daily.cycles).toBe(1);
  });
});

describe('bank loan repayment', () => {
  it('pays back manually, never more than cash or debt', () => {
    const s = officeGame();
    s.company.debt = 80_000;
    s.company.cash = 30_000;
    applyAction(s, { type: 'repay', amount: 50_000 });
    expect(s.company.debt).toBe(50_000);
    expect(s.company.cash).toBe(0);
    expect(applyAction(s, { type: 'repay', amount: 1 })[0]).toMatchObject({ type: 'rejected', reason: 'noCash' });
  });

  it('spare cash above the reserve goes to the bank at week end', () => {
    const s = officeGame();
    s.products.forEach((p) => (p.active = false));
    s.company.debt = 100_000;
    s.company.cash = 200_000;
    while (s.day % 7 !== 6) advanceDay(s);
    advanceDay(s);
    expect(s.company.debt).toBe(0);
    expect(s.company.lastRepay).toBeGreaterThan(0);
    // A small debt with little cash: the reserve is kept.
    s.company.debt = 50_000;
    s.company.cash = 10_000;
    for (let i = 0; i < 7; i++) advanceDay(s);
    expect(s.company.debt).toBeGreaterThan(49_000);
  });
});
