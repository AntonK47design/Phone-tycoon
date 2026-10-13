// Opt-in rewarded-ad button (GDD §21). Hidden when ads can't play or the bonus isn't available.

import { useState } from 'preact/hooks';
import { rewardAvailable, type AdRewardKind } from '../../sim/rewards';
import { cooldownSeconds, rewardedEnabled, watchRewarded } from '../ads';
import { useGameState } from '../game';
import { t } from '../i18n';

export function RewardedButton({ kind, productId, small }: { kind: AdRewardKind; productId?: number; small?: boolean }) {
  const state = useGameState();
  const [busy, setBusy] = useState(false);
  if (!rewardedEnabled.value || !rewardAvailable(state, kind, productId)) return null;
  const wait = cooldownSeconds(kind);
  const label = wait > 0 ? t('ads.wait', { m: Math.floor(wait / 60), s: String(wait % 60).padStart(2, '0') }) : t(`ads.offer.${kind}`);
  return (
    <button
      class={`btn-rewarded ${small ? 'small' : ''}`}
      disabled={busy || wait > 0}
      onClick={async () => {
        setBusy(true);
        await watchRewarded(kind, productId);
        setBusy(false);
      }}
    >
      <i class="ad-badge">▶</i> {label}
    </button>
  );
}
