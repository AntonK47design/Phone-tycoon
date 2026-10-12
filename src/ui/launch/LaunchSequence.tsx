// Launch cinematic: overnight time-lapse (first phone), show, pre-orders, review cards,
// result + unlock + "up next" teaser.

import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { colorById } from '../../data/design';
import { OUTLETS } from '../../data/market';
import { GOALS } from '../../data/goals';
import type { SimEvent } from '../../sim/events';
import { goalProgress, visibleGoals } from '../../sim/goals';
import { decimal, money, shortNum } from '../format';
import { mark } from '../funnel';
import { cashOverride, game, launchData, mode, speed, useGameState } from '../game';
import { lang, t } from '../i18n';
import { flushDeferred, flyCoins } from '../juice';
import { useRolling } from '../hud/Hud';
import { scoreClass } from '../hud/Panels';

type Phase = 'overnight' | 'show' | 'preorders' | 'reviews' | 'result';

export function LaunchSequence() {
  const data = launchData.value!;
  const { store, engine, save } = game();
  const state = useGameState();
  const [phase, setPhase] = useState<Phase>(data.firstLaunch ? 'overnight' : 'show');
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [cardsShown, setCardsShown] = useState(0);
  const [counter, setCounter] = useState(0);
  const startCash = useRef(state.company.cash);
  const timers = useRef<number[]>([]);
  const l = lang.value;

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  useEffect(() => {
    cashOverride.value = startCash.current;
    const doLaunch = () => {
      const ev = store.dispatch({ type: 'launch' });
      setEvents(ev);
      save();
      setPhase('show');
      engine.playLaunch();
      sfx.fanfare();
      later(1700, () => setPhase('preorders'));
    };
    if (data.firstLaunch) {
      engine.setNight(true);
      sfx.clock();
      later(2600, () => {
        engine.setNight(false);
        doLaunch();
      });
    } else doLaunch();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const launched = events.find((e) => e.type === 'launched');
  const product = launched ? state.products.find((p) => p.id === launched.productId) : undefined;

  // Pre-order counter + cash roll.
  useEffect(() => {
    if (phase !== 'preorders' || !launched) return;
    const target = launched.preorderRevenue;
    const endCash = store.getState().company.cash;
    const t0 = performance.now();
    const dur = 1800;
    let raf = 0;
    let lastTick = 0;
    const p = engine.project('phone');
    flyCoins({ x: p.x, y: p.y + 60 }, 12);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setCounter(target * e);
      cashOverride.value = startCash.current + (endCash - startCash.current) * e;
      if (now - lastTick > 70 && k < 1) {
        lastTick = now;
        sfx.tick();
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        sfx.coin(1.2);
        later(700, () => setPhase('reviews'));
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, launched?.type]);

  // Review cards fly in one by one.
  useEffect(() => {
    if (phase !== 'reviews') return;
    engine.endLaunch();
    for (let i = 0; i < 3; i++) {
      later(250 + i * 520, () => {
        setCardsShown(i + 1);
        sfx.card(i);
      });
    }
    later(250 + 3 * 520 + 300, () => {
      setPhase('result');
      mark('reward');
      sfx.unlock2();
    });
  }, [phase]);

  const finish = () => {
    sfx.click();
    cashOverride.value = null;
    launchData.value = null;
    mode.value = 'free';
    if (store.getState().tutorial !== 'done') store.dispatch({ type: 'setTutorial', step: 'done' });
    engine.goToView('overview', 1.4);
    if (speed.value === 0) speed.value = 1;
    flushDeferred();
    save();
  };

  const unlocks = events.filter((e): e is Extract<SimEvent, { type: 'colorUnlocked' }> => e.type === 'colorUnlocked');

  return (
    <div class="ui-layer">
      {phase === 'overnight' && (
        <div class="overnight passthrough">
          <div>
            <div class="clock"><i class="h" /><i class="m" /></div>
            <p>{t('launch.overnight')}</p>
          </div>
        </div>
      )}
      {(phase === 'show' || phase === 'preorders') && product && (
        <div class="launch-title passthrough">
          <small>{t('launch.now')}</small>
          {product.design.name}
        </div>
      )}
      {phase === 'preorders' && launched && (
        <div class="glass preorders passthrough">
          <div class="lbl">{t('launch.preorders')}</div>
          <div class="money">{money(counter, l)}</div>
          <div class="units">{t('launch.units', { n: shortNum(launched.preorderUnits, l) })}</div>
        </div>
      )}
      {(phase === 'reviews' || phase === 'result') && launched && product && (
        <div class="result">
          <h2>{t('launch.reviews')}</h2>
          <div class="cards">
            {launched.review.cards.slice(0, cardsShown).map((c) => {
              const outlet = OUTLETS.find((o) => o.id === c.outletId);
              return (
                <div class={`review-card ${scoreClass(c.score)}`} key={c.outletId}>
                  <div class="outlet">{outlet?.name}</div>
                  <div class="score">
                    {decimal(c.score, l)}
                    <small>/10</small>
                  </div>
                  <div class="quote">“{t(`review.${c.quote}`)}”</div>
                </div>
              );
            })}
          </div>
          {phase === 'result' && (
            <ResultSummary
              review={launched.review.score}
              revenue={launched.preorderRevenue}
              profit={store.getState().company.cash - startCash.current}
              brandDelta={launched.brandDelta}
              unlocks={unlocks.map((u) => u.colorId)}
              onContinue={finish}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ResultSummary(props: {
  review: number;
  revenue: number;
  profit: number;
  brandDelta: number;
  unlocks: string[];
  onContinue: () => void;
}) {
  const state = useGameState();
  const l = lang.value;
  const review = useRolling(props.review, 0.25);
  const teaser = nextTeaser(state);
  return (
    <>
      <div class="result-summary">
        <div class="glass" data-tip={t('tip.review')}>
          <div class="k">{t('launch.score')}</div>
          <div class="v">{decimal(review, l)}</div>
        </div>
        <div class="glass">
          <div class="k">{t('launch.revenue')}</div>
          <div class="v" style={{ color: 'var(--money)' }}>{money(props.revenue, l)}</div>
        </div>
        <div class="glass" data-tip={t('tip.brand')}>
          <div class="k">{t('hud.brand')}</div>
          <div class="v">+{decimal(props.brandDelta, l, 0)}</div>
        </div>
      </div>
      {props.unlocks.map((id) => (
        <div class="glass unlock-card" key={id}>
          <span class="sw" style={{ background: colorById(id)?.hex }} />
          <b>{t('launch.unlockColor', { color: t(`color.${id}`) })}</b>
        </div>
      ))}
      {teaser && (
        <div class="teaser">
          {t('launch.next')}: <b>{teaser}</b>
        </div>
      )}
      <button class="btn-primary" onClick={props.onContinue}>
        {t('launch.continue')}
      </button>
    </>
  );
}

function nextTeaser(state: ReturnType<typeof useGameState>): string | null {
  const l = lang.value;
  if (state.officeReady) return t('teaser.officeReady');
  const office = GOALS.find((g) => g.id === 'office')!;
  if (state.completedGoals.includes('secondLaunch')) {
    const missing = Math.max(0, office.target - goalProgress(state, office));
    return t('teaser.office', { amount: money(missing, l) });
  }
  if (state.stats.launches === 1) return t('teaser.secondLaunch');
  const g = visibleGoals(state)[0];
  return g ? t('teaser.generic', { goal: t(`goals.${g.id}`) }) : null;
}
