// Ads (GDD §21): midgame after launch results / phase changes, opt-in rewarded bonuses.
// Rules live in platform/adPolicy.ts; the ledger is kept per browser in localStorage.

import { computed, signal } from '@preact/signals';
import { sfx } from '../audio/sfx';
import {
  canMidgame,
  midgameShown,
  newLedger,
  rewardedCooldown,
  rewardedShown,
  type AdLedger,
} from '../platform/adPolicy';
import type { AdType } from '../platform/platform';
import type { AdRewardKind } from '../sim/rewards';
import { adPlaying, game, mode, settingsOpen, speed, toast } from './game';
import { t } from './i18n';

const KEY = 'phone-empire-ads';
const TICK_MS = 1000;

function load(): AdLedger {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...newLedger(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return newLedger();
}

const ledger = signal<AdLedger>(load());
function store(next: AdLedger) {
  ledger.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const blocked = signal(false);
/** Rewarded buttons only show where an ad can actually play (CrazyGames, or a dev fake). */
export const rewardedEnabled = computed(() => (game().platform.name === 'crazygames' || import.meta.env.DEV) && !blocked.value);

export function installAds() {
  game()
    .platform.hasAdblock()
    .then((b) => (blocked.value = b))
    .catch(() => {});
  // Count active play time (visible page, past the intro, no ad running).
  let n = 0;
  setInterval(() => {
    if (document.hidden || mode.value === 'intro' || adPlaying.value) return;
    const next = { ...ledger.value, playMs: ledger.value.playMs + TICK_MS };
    if (++n % 10 === 0) store(next);
    else ledger.value = next;
  }, TICK_MS);
}

async function show(type: AdType): Promise<boolean> {
  if (adPlaying.value) return false;
  const { platform, gameplay } = game();
  const outcome = await platform.requestAd(type, {
    onStart: () => {
      adPlaying.value = true;
      sfx.setAdMuted(true);
      gameplay.stop();
    },
  });
  adPlaying.value = false;
  sfx.setAdMuted(false);
  if (!settingsOpen.value && speed.value > 0 && mode.value !== 'intro') gameplay.start();
  return outcome === 'finished';
}

/** Counts a launch towards the "one midgame per 3 launches" rule. */
export function noteLaunch() {
  store({ ...ledger.value, launches: ledger.value.launches + 1 });
}

/** Shows a midgame ad if the rules allow it right now. */
export async function maybeMidgame(reason: 'launch' | 'phase') {
  if (!canMidgame(ledger.value, reason) || adPlaying.value) return;
  const { platform } = game();
  if (platform.name !== 'crazygames' && !import.meta.env.DEV) return;
  store(midgameShown(ledger.value));
  await show('midgame');
}

/** Seconds until this rewarded bonus is available again (0 = ready). */
export function cooldownSeconds(kind: AdRewardKind): number {
  return Math.ceil(rewardedCooldown(ledger.value, kind) / 1000);
}

/** Plays a rewarded ad and grants the bonus when it finished. */
export async function watchRewarded(kind: AdRewardKind, productId?: number): Promise<boolean> {
  if (cooldownSeconds(kind) > 0) return false;
  const ok = await show('rewarded');
  if (!ok) {
    toast(t('ads.unavailable'), 'warn');
    return false;
  }
  store(rewardedShown(ledger.value, kind));
  const ev = game().store.dispatch({ type: 'adReward', kind, productId });
  if (ev[0]?.type === 'adReward') {
    sfx.fanfare();
    toast(t(`ads.done.${kind}`), 'spark', true);
    return true;
  }
  return false;
}
