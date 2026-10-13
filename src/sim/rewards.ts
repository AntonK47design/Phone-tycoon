// Rewarded-ad bonuses (GDD §21). The platform decides *whether* an ad ran; the sim decides
// what it is worth and that each bonus can be claimed only once per launch / project / return.

import { researchById } from '../data/research';
import type { SimEvent } from './events';
import { researchCost } from './research';
import type { GameState } from './state';
import { yearOf } from './time';

export type AdRewardKind = 'launchDouble' | 'devBoost' | 'researchBoost' | 'offlineDouble';

/** A launch can be doubled within a week of its release. */
const LAUNCH_WINDOW_DAYS = 7;

/** What the reward would pay or do right now (null = not available). */
export function rewardAvailable(state: GameState, kind: AdRewardKind, productId?: number): boolean {
  switch (kind) {
    case 'launchDouble': {
      const p = state.products.find((x) => x.id === productId);
      return !!p && !p.adDoubled && (p.preorderRevenue ?? 0) > 0 && state.day - p.launchDay <= LAUNCH_WINDOW_DAYS;
    }
    case 'devBoost':
      return !!state.dev && !state.dev.done && !state.dev.adBoosted;
    case 'researchBoost':
      return !!state.research.current && !state.research.current.adBoosted;
    case 'offlineDouble':
      return !!state.lastOffline && !state.lastOffline.claimed && state.lastOffline.cash > 0;
  }
}

export function applyAdReward(state: GameState, kind: AdRewardKind, productId?: number): SimEvent[] {
  if (!rewardAvailable(state, kind, productId)) return [{ type: 'rejected', reason: 'notReady' }];
  let amount = 0;
  switch (kind) {
    case 'launchDouble': {
      const p = state.products.find((x) => x.id === productId)!;
      amount = p.preorderRevenue!;
      state.company.cash += amount;
      p.adDoubled = true;
      break;
    }
    case 'devBoost': {
      // Half of the remaining development work is done at once.
      const dev = state.dev!;
      for (const k of ['design', 'tech', 'software'] as const) dev.progress[k] += (dev.required[k] - dev.progress[k]) * 0.5;
      dev.adBoosted = true;
      break;
    }
    case 'researchBoost': {
      // +20 % of the project's research points, at most up to completion.
      const cur = state.research.current!;
      const node = researchById(cur.id);
      if (node) {
        const need = researchCost(node, yearOf(state.day), state).rp;
        cur.progress = Math.min(need, cur.progress + need * 0.2);
      }
      cur.adBoosted = true;
      break;
    }
    case 'offlineDouble': {
      amount = state.lastOffline!.cash;
      state.company.cash += amount;
      state.lastOffline!.claimed = true;
      break;
    }
  }
  return [{ type: 'adReward', kind, amount }];
}
