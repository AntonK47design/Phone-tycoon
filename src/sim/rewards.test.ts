import { describe, expect, it } from 'vitest';
import { RESEARCH } from '../data/research';
import { advanceDay, applyAction, newGame } from './game';
import { applyOffline } from './offline';
import { rewardAvailable } from './rewards';

function launched() {
  const s = newGame(11);
  applyAction(s, { type: 'setTutorial', step: 'done' });
  applyAction(s, { type: 'launch' });
  return s;
}

describe('rewarded bonuses (GDD §21)', () => {
  it('doubles a fresh launch once', () => {
    const s = launched();
    const p = s.products[0];
    expect(p.preorderRevenue).toBeGreaterThan(0);
    const cash = s.company.cash;
    const ev = applyAction(s, { type: 'adReward', kind: 'launchDouble', productId: p.id });
    expect(ev[0]).toMatchObject({ type: 'adReward', amount: p.preorderRevenue });
    expect(s.company.cash).toBeCloseTo(cash + p.preorderRevenue!, 6);
    expect(applyAction(s, { type: 'adReward', kind: 'launchDouble', productId: p.id })[0].type).toBe('rejected');
  });

  it('a launch older than a week cannot be doubled', () => {
    const s = launched();
    for (let i = 0; i < 8; i++) advanceDay(s);
    expect(rewardAvailable(s, 'launchDouble', s.products[0].id)).toBe(false);
  });

  it('halves the remaining development once', () => {
    const s = launched();
    s.company.cash = 1e6;
    applyAction(s, { type: 'startDev' });
    const dev = s.dev!;
    const left = dev.required.tech - dev.progress.tech;
    applyAction(s, { type: 'adReward', kind: 'devBoost' });
    expect(dev.required.tech - dev.progress.tech).toBeCloseTo(left / 2, 6);
    expect(rewardAvailable(s, 'devBoost')).toBe(false);
  });

  it('adds 20 % research to the current project once', () => {
    const s = launched();
    s.phase = 2;
    s.research.current = { id: RESEARCH[0].id, progress: 0 };
    applyAction(s, { type: 'adReward', kind: 'researchBoost' });
    expect(s.research.current!.progress).toBeGreaterThan(0);
    expect(rewardAvailable(s, 'researchBoost')).toBe(false);
  });

  it('doubles offline earnings once, never losses', () => {
    const s = launched();
    applyOffline(s, 3600);
    if (s.lastOffline!.cash > 0) {
      const cash = s.company.cash;
      applyAction(s, { type: 'adReward', kind: 'offlineDouble' });
      expect(s.company.cash).toBeCloseTo(cash + s.lastOffline!.cash, 6);
    }
    expect(rewardAvailable(s, 'offlineDouble')).toBe(false);
  });
});
