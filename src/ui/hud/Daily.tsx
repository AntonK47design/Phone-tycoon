// Daily calendar (7 friendly days, nothing resets) and three mini orders per day.

import { useEffect } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { calendarClaimable, calendarReward, CALENDAR_BASE, dailyProgress } from '../../sim/daily';
import type { DailyOrder, GameState } from '../../sim/state';
import { decimal, money, shortNum } from '../format';
import { dailyOpen, game, mode, today, useGameState } from '../game';
import { lang, t, type Lang } from '../i18n';
import { IconClose, IconTrophy } from '../icons';

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4M8 15h2M14 15h2" />
  </svg>
);

/** Something to collect? (badge on the HUD button) */
export function dailyPending(state: GameState): boolean {
  return calendarClaimable(state, today()) || state.daily.orders.some((o) => o.done && !o.claimed);
}

/** Keeps the orders in sync with the real date; opens once for returning players. */
export function useDailySync() {
  const { store } = game();
  useEffect(() => {
    const sync = () => {
      const s = store.getState();
      if (s.clockStarted && s.daily.date !== today()) store.dispatch({ type: 'dailySync', date: today() });
    };
    sync();
    const id = window.setInterval(sync, 30_000);
    // Returning players get the calendar once per day (never during the first session).
    const s = store.getState();
    if (s.daily.lastClaim !== null && calendarClaimable(s, today())) {
      const open = () => mode.value === 'free' && (dailyOpen.value = true);
      window.setTimeout(open, 1800);
    }
    return () => clearInterval(id);
  }, [store]);
}

export function DailyButton() {
  const state = useGameState();
  if (!state.clockStarted || state.stats.launches < 1) return null;
  const pending = dailyPending(state);
  return (
    <button class={`glass icon-btn daily-btn ${pending ? 'pending' : ''}`} aria-label={t('daily.title')} data-tip={t('daily.title')} onClick={() => ((dailyOpen.value = true), sfx.click())}>
      <CalendarIcon />
      {pending && <i class="dot-alert" />}
    </button>
  );
}

function orderText(o: DailyOrder, l: Lang): string {
  switch (o.kind) {
    case 'sell':
      return t('daily.order.sell', { n: shortNum(o.target, l) });
    case 'revenue':
      return t('daily.order.revenue', { amount: money(o.target, l) });
    case 'launch':
      return t('daily.order.launch', { score: decimal(o.target, l) });
    default:
      return t(`daily.order.${o.kind}`);
  }
}

export function DailyModal() {
  const state = useGameState();
  const { store } = game();
  const l = lang.value;
  if (!dailyOpen.value) return null;
  const date = today();
  const claimable = calendarClaimable(state, date);
  const reward = calendarReward(state);
  const step = state.daily.calendarStep;
  const claim = () => {
    const ev = store.dispatch({ type: 'claimCalendar', date });
    if (ev[0]?.type === 'calendarClaimed') {
      sfx.coin(1.3);
      sfx.unlock2();
    }
  };
  const claimOrder = (i: number) => {
    const ev = store.dispatch({ type: 'claimDaily', index: i });
    if (ev[0]?.type === 'dailyClaimed') sfx.coin(1.1);
  };
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && (dailyOpen.value = false)}>
      <div class="paper modal daily">
        <button class="icon-btn drawer-close" aria-label="close" onClick={() => ((dailyOpen.value = false), sfx.click())}>
          <IconClose />
        </button>
        <h3 class="drawer-title">{t('daily.title')}</h3>
        <p class="muted">{t('daily.calendarHint')}</p>
        <div class="cal-strip">
          {CALENDAR_BASE.map((_, i) => {
            const done = i < step;
            const now = i === step;
            const aurora = i === 6 && !state.cosmetics.includes('aurora');
            return (
              <div key={i} class={`cal-day ${done ? 'done' : ''} ${now ? 'now' : ''} ${i === 6 ? 'big' : ''}`}>
                <span class="cal-n">{t('daily.day', { n: i + 1 })}</span>
                <span class="cal-r">{now ? money(reward.cash, l) : done ? '✓' : aurora ? t('daily.aurora') : '?'}</span>
                {aurora && i === 6 && <span class="cal-swatch" />}
              </div>
            );
          })}
        </div>
        <button class="btn-primary cal-claim" disabled={!claimable} onClick={claim}>
          {claimable ? t('daily.claim', { amount: money(reward.cash, l) }) + (reward.cosmetic ? ` + ${t('daily.aurora')}` : '') : t('daily.comeBack')}
        </button>

        <h4 class="drawer-sub">{t('daily.orders')}</h4>
        {state.daily.orders.length === 0 && <p class="muted">{t('daily.noOrders')}</p>}
        {state.daily.orders.map((o, i) => {
          const p = dailyProgress(state, o);
          return (
            <div class={`order ${o.claimed ? 'claimed' : ''}`} key={`${state.daily.date}-${i}`}>
              <div class="order-main">
                <b>{orderText(o, l)}</b>
                <span class="muted">
                  {o.reward.cash ? money(o.reward.cash, l) : ''}
                  {o.reward.hype ? ` + ${t('daily.hype', { n: o.reward.hype })}` : ''}
                </span>
                <div class="bar light"><i style={{ width: `${p * 100}%`, background: 'var(--orange)' }} /></div>
              </div>
              {o.claimed ? (
                <span class="node-note ok"><IconTrophy size={16} /></span>
              ) : (
                <button class="btn-secondary" disabled={!o.done} onClick={() => claimOrder(i)}>{t('daily.collect')}</button>
              )}
            </div>
          );
        })}
        <p class="muted small">{t('daily.resetHint')}</p>
      </div>
    </div>
  );
}
