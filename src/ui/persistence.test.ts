import { describe, expect, it } from 'vitest';
import { newGame } from '../sim/game';
import { serialize } from '../sim/save/save';
import { pickNewest } from './persistence';

describe('cloud save conflicts', () => {
  it('loads the newest copy and skips broken ones', () => {
    const old = newGame(1);
    const fresh = newGame(2);
    fresh.company.cash = 123_456;
    const picked = pickNewest(['{broken', serialize(old, 1000), serialize(fresh, 2000)]);
    expect(picked?.savedAt).toBe(2000);
    expect(picked?.state.company.cash).toBe(123_456);
    expect(pickNewest([serialize(fresh, 2000), serialize(old, 1000)])?.savedAt).toBe(2000);
    expect(pickNewest([])).toBeNull();
  });
});
