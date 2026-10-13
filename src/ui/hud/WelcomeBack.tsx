import { sfx } from '../../audio/sfx';
import { money, shortNum } from '../format';
import { welcomeReport } from '../game';
import { lang, t } from '../i18n';
import { researchNameById } from '../labels';
import { useRolling } from './Hud';
import { RewardedButton } from './Rewarded';

export function WelcomeBack() {
  const r = welcomeReport.value;
  const cash = useRolling(r ? r.cashDelta : 0, 0.6);
  const sold = useRolling(r ? r.unitsSold : 0, 0.6);
  if (!r) return null;
  const l = lang.value;
  const h = Math.floor(r.seconds / 3600);
  const m = Math.floor((r.seconds % 3600) / 60);
  const close = () => {
    sfx.click();
    welcomeReport.value = null;
  };
  return (
    <div class="modal-back">
      <div class="glass modal welcome" role="dialog" aria-label={t('welcome.title')}>
        <h3>{t('welcome.title')}</h3>
        <p class="muted">{t('welcome.time', { h, m, days: r.days })}</p>
        <div class="kpis">
          <div class="kpi"><span class="label">{t('welcome.cash')}</span><b class={r.cashDelta >= 0 ? 'pos' : 'neg'}>{r.cashDelta >= 0 ? '+' : ''}{money(cash, l)}</b></div>
          <div class="kpi"><span class="label">{t('welcome.sold')}</span><b>{shortNum(sold, l)}</b></div>
        </div>
        {r.researchDone.length > 0 && (
          <div class="welcome-line"><span class="label">{t('welcome.research')}</span> {r.researchDone.map(researchNameById).join(', ')}</div>
        )}
        {r.devDone && <div class="welcome-line good-line">{t('welcome.dev')}</div>}
        {r.ordersArrived > 0 && <div class="welcome-line"><span class="label">{t('welcome.orders')}</span> {r.ordersArrived}</div>}
        <RewardedButton kind="offlineDouble" />
        <button class="btn-primary" onClick={close}>{t('welcome.go')}</button>
      </div>
    </div>
  );
}
