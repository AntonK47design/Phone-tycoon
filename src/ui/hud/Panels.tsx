import { useEffect, useRef } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { colorById } from '../../data/design';
import { goalProgress, visibleGoals } from '../../sim/goals';
import { decimal, money, shortNum } from '../format';
import { game, hubView, mode, sayBark, bark, toVisual, toasts, useGameState } from '../game';
import { lang, t, tList } from '../i18n';
import { openLaunchSetup } from '../launch/LaunchSetup';
import { IconBuilding, IconPencil, IconRocket, IconWrench, ToastIconView } from '../icons';
import { OFFICE_PRICE } from '../../data/components';
import { inflation } from '../../data/eras';
import { calendar } from '../../sim/time';
import { RewardedButton } from './Rewarded';

export function scoreClass(score: number) {
  return score >= 8 ? 'good' : score >= 6.5 ? 'ok' : 'bad';
}

export function Goals() {
  const state = useGameState();
  const goals = visibleGoals(state);
  const l = lang.value;
  if (!goals.length) return null;
  return (
    <div class="glass goals">
      <h4>{t('goals.title')}</h4>
      {goals.map((g) => {
        const p = Math.min(1, goalProgress(state, g) / g.target);
        const reward = g.reward.cash
          ? t('goals.rewardCash', { amount: money(g.reward.cash, l) })
          : g.reward.unlockColor
            ? t('goals.rewardColor')
            : '';
        return (
          <div class="goal enter" key={g.id}>
            <div class="goal-title">
              <span>{t(`goals.${g.id}`)}</span>
              {reward && <span class="goal-reward">{reward}</span>}
            </div>
            <div class="goal-bar"><i style={{ width: `${p * 100}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function Products() {
  const state = useGameState();
  const l = lang.value;
  if (!state.products.length) return null;
  const list = [...state.products].reverse().slice(0, 5);
  return (
    <div class="glass products">
      <h4>{t('products.title')}</h4>
      {list.map((p) => (
        <div class={`product ${p.active ? '' : 'retired'}`} key={p.id}>
          <span class="dot" style={{ background: colorById(p.design.colorId)?.hex ?? '#888' }} />
          <div>
            <div class="name">{p.design.name}</div>
            <div class="sub">
              {p.active ? t('products.perWeek', { n: shortNum(p.lastWeekUnits || p.weekUnits, l) }) : t('products.retired')} ·{' '}
              {t('products.sold', { n: shortNum(p.unitsSold, l) })}
              {p.active && p.madeToOrder && p.capped && <div class="capped">{t('products.capped')}</div>}
              {p.active && !p.madeToOrder && (
                <div class={p.stock > 0 ? '' : 'capped'}>{p.stock > 0 ? `${t('company.stock')} ${shortNum(p.stock, l)}` : t('company.soldOut')}</div>
              )}
            </div>
          </div>
          <span class={`score-pill ${scoreClass(p.review.score)}`}>{decimal(p.review.score, l)}</span>
        </div>
      ))}
    </div>
  );
}

export function ActionBar() {
  const state = useGameState();
  const { engine, store } = game();
  const dev = state.dev;
  if (dev && !dev.done) {
    const r = dev.required;
    const p = dev.progress;
    const pct = Math.round(((p.design + p.tech + p.software) / (r.design + r.tech + r.software)) * 100);
    return (
      <div class="action-bar">
        <div class="glass dev-progress">
          <div class="row">
            <span>{dev.design.name}</span>
            <span>{t('action.developing', { p: pct })}</span>
          </div>
          <div class="tri-bar">
            <div><i style={{ width: `${(p.design / r.design) * 100}%`, background: 'var(--design)' }} /></div>
            <div><i style={{ width: `${(p.tech / r.tech) * 100}%`, background: 'var(--tech)' }} /></div>
            <div><i style={{ width: `${(p.software / r.software) * 100}%`, background: 'var(--software)' }} /></div>
          </div>
          <RewardedButton kind="devBoost" small />
        </div>
      </div>
    );
  }
  if (dev?.done) {
    return (
      <div class="action-bar">
        <button class="btn-primary btn-launch pulse" onClick={openLaunchSetup}>
          <IconRocket size={24} /> {t('action.ready', { name: dev.design.name })}
        </button>
      </div>
    );
  }
  const open = () => {
    sfx.whoosh();
    mode.value = 'editor';
    engine.goToView('editor', 1.1);
    engine.setPhone(toVisual(state.draft));
  };
  const officePrice = OFFICE_PRICE * inflation(calendar(state.day).year);
  const rent = () => {
    const ev = store.dispatch({ type: 'rentOffice' });
    if (ev.some((e) => e.type === 'officeRented')) sfx.fanfare();
  };
  return (
    <div class="action-bar">
      {state.phase < 2 && state.officeReady && (
        <button class="btn-primary btn-office" disabled={state.company.cash < officePrice} onClick={rent}>
          <IconBuilding /> {t('office.rent', { price: money(officePrice, lang.value) })}
        </button>
      )}
      <button class="btn-primary" onClick={open}><IconPencil /> {t('action.newPhone')}</button>
    </div>
  );
}

export function Toasts() {
  return (
    <div class="toasts">
      {toasts.value.map((x) => (
        <div key={x.id} class={`glass toast ${x.gold ? 'gold' : ''}`}>
          {x.icon && <span class="ic"><ToastIconView kind={x.icon} /></span>}
          {x.text}
        </div>
      ))}
    </div>
  );
}

/** Progress label floating above the workbench while the founder develops. */
export function BenchLabel() {
  const state = useGameState();
  const ref = useRef<HTMLDivElement>(null);
  const { engine } = game();
  const dev = state.dev;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = ref.current;
      if (!el) return;
      const p = engine.project('bench');
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.opacity = p.visible ? '1' : '0';
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [engine]);
  if (!dev || dev.done || mode.value !== 'free') return null;
  const r = dev.required;
  const p = dev.progress;
  return (
    <div class="glass world-label passthrough" ref={ref}>
      <IconWrench size={14} /> {dev.design.name}
      <div class="tri-bar">
        <div><i style={{ width: `${(p.design / r.design) * 100}%`, background: 'var(--design)' }} /></div>
        <div><i style={{ width: `${(p.tech / r.tech) * 100}%`, background: 'var(--tech)' }} /></div>
        <div><i style={{ width: `${(p.software / r.software) * 100}%`, background: 'var(--software)' }} /></div>
      </div>
    </div>
  );
}

/** The founder thinks out loud now and then. */
export function FounderBark() {
  const state = useGameState();
  const ref = useRef<HTMLDivElement>(null);
  const { engine } = game();
  const developing = !!state.dev && !state.dev.done;
  useEffect(() => {
    let timer = 0;
    const schedule = (first = false) => {
      timer = window.setTimeout(() => {
        if (mode.value === 'free' && !document.hidden) sayBark(tList(developing ? 'barks.dev' : 'barks.idle'));
        schedule();
      }, first ? 6000 + Math.random() * 4000 : 22000 + Math.random() * 16000);
    };
    schedule(true);
    return () => clearTimeout(timer);
  }, [developing]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = ref.current;
      if (!el) return;
      const p = engine.project('founder');
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.visibility = p.visible ? 'visible' : 'hidden';
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [engine, bark.value?.id]);
  const b = bark.value;
  // The founder lives in the garage.
  if (!b || mode.value !== 'free' || hubView.value !== 'garage') return null;
  return (
    <div class="bark passthrough" ref={ref} key={b.id}>
      {b.text}
    </div>
  );
}
