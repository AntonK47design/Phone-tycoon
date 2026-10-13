import { describe, expect, it } from 'vitest';
import { canMidgame, midgameShown, newLedger, rewardedCooldown, rewardedShown } from './adPolicy';

const MIN = 60_000;

describe('ad rules (GDD §21)', () => {
  it('no midgame in the first 5 minutes, then one per 3 launches and 6 minutes apart', () => {
    let l = { ...newLedger(), launches: 5, playMs: 4 * MIN };
    expect(canMidgame(l, 'launch')).toBe(false);
    l = { ...l, playMs: 5 * MIN };
    expect(canMidgame(l, 'launch')).toBe(true);
    l = midgameShown(l);
    l = { ...l, launches: 3, playMs: l.playMs + 5 * MIN };
    expect(canMidgame(l, 'launch')).toBe(false);
    l = { ...l, playMs: l.playMs + MIN };
    expect(canMidgame(l, 'launch')).toBe(true);
    expect(canMidgame({ ...l, launches: 2 }, 'launch')).toBe(false);
    expect(canMidgame({ ...l, launches: 0 }, 'phase')).toBe(true);
  });

  it('each rewarded bonus has its own 5-minute cooldown', () => {
    let l = { ...newLedger(), playMs: 10 * MIN };
    expect(rewardedCooldown(l, 'devBoost')).toBe(0);
    l = rewardedShown(l, 'devBoost');
    l = { ...l, playMs: l.playMs + 2 * MIN };
    expect(rewardedCooldown(l, 'devBoost')).toBe(3 * MIN);
    expect(rewardedCooldown(l, 'researchBoost')).toBe(0);
    l = { ...l, playMs: l.playMs + 3 * MIN };
    expect(rewardedCooldown(l, 'devBoost')).toBe(0);
  });
});
