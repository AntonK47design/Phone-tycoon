// Ad rules (GDD §21), measured in active play time so they hold across sessions:
// midgame never in the first 5 minutes, at least 6 minutes apart, at most one per 3 launches;
// each rewarded bonus has a 5-minute cooldown.

const MIN = 60_000;
export const MIDGAME_GRACE_MS = 5 * MIN;
export const MIDGAME_GAP_MS = 6 * MIN;
export const MIDGAME_LAUNCHES = 3;
export const REWARDED_COOLDOWN_MS = 5 * MIN;

export interface AdLedger {
  /** Total active play time in ms. */
  playMs: number;
  /** Play time at the last midgame ad (null = none yet). */
  lastMidgame: number | null;
  /** Launches since the last midgame ad (or since the start). */
  launches: number;
  /** Play time at the last rewarded ad, per bonus kind. */
  rewarded: Record<string, number>;
}

export function newLedger(): AdLedger {
  return { playMs: 0, lastMidgame: null, launches: 0, rewarded: {} };
}

export function canMidgame(l: AdLedger, reason: 'launch' | 'phase'): boolean {
  if (l.playMs < MIDGAME_GRACE_MS) return false;
  if (l.lastMidgame !== null && l.playMs - l.lastMidgame < MIDGAME_GAP_MS) return false;
  // After a launch: only every third one. A phase change is rare enough on its own.
  return reason === 'phase' || l.launches >= MIDGAME_LAUNCHES;
}

export function midgameShown(l: AdLedger): AdLedger {
  return { ...l, lastMidgame: l.playMs, launches: 0 };
}

export function rewardedCooldown(l: AdLedger, kind: string): number {
  const last = l.rewarded[kind];
  return last === undefined ? 0 : Math.max(0, REWARDED_COOLDOWN_MS - (l.playMs - last));
}

export function rewardedShown(l: AdLedger, kind: string): AdLedger {
  return { ...l, rewarded: { ...l.rewarded, [kind]: l.playMs } };
}
