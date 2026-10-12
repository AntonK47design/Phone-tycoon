// M5 UI: news ticker, event cards, and the World tab (regions, stores, contracts).

import { sfx } from '../../audio/sfx';
import { MAX_STORES, REGIONS } from '../../data/regions';
import { currentReview } from '../../sim/game';
import { yearOf } from '../../sim/time';
import { contractProblem, contractValue, entryCost, regionReach, storeCost } from '../../sim/world';
import { decimal, money, shortNum } from '../format';
import { dailyOpen, game, launchSetupOpen, mode, settingsOpen, toast, useGameState, welcomeReport } from '../game';
import { lang, t } from '../i18n';
import { newsText } from '../labels';

/** Scrolling headline strip (newest first). */
export function NewsTicker() {
  const state = useGameState();
  if (state.phase < 2 || mode.value !== 'free' || !state.news.length) return null;
  const items = [...state.news].reverse().slice(0, 6);
  return (
    <div class="ticker passthrough" aria-live="polite">
      <span class="ticker-tag">{t('news.tag')}</span>
      <div class="ticker-track">
        <div class="ticker-run" key={items[0].day + items[0].kind}>
          {items.map((n, i) => (
            <span key={i} class="ticker-item">{newsText(n)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Event card with a decision (chip shortage, recall …). */
export function EventCard() {
  const state = useGameState();
  const { store } = game();
  const p = state.events.pending;
  // Never stack on top of another dialog.
  if (!p || mode.value !== 'free' || welcomeReport.value || dailyOpen.value || launchSetupOpen.value || settingsOpen.value) return null;
  const l = lang.value;
  const product = p.target ? state.products.find((x) => String(x.id) === p.target) : null;
  const pick = (option: string) => {
    const ev = store.dispatch({ type: 'eventChoice', option });
    if (ev[0]?.type === 'rejected') toast(t('toast.noCash'), 'warn');
    else sfx.click();
  };
  return (
    <div class="modal-back">
      <div class="paper modal event-card">
        <span class="event-kicker">{t('event.kicker')}</span>
        <h3>{t(`event.${p.id}.title`)}</h3>
        <p>{t(`event.${p.id}.text`, { name: product?.design.name ?? '', amount: money(p.amount ?? 0, l) })}</p>
        <div class="event-options">
          {p.options.map((o) => (
            <button key={o} class={o === p.options[0] ? 'btn-primary' : 'btn-secondary'} onClick={() => pick(o)}>
              <b>{t(`event.${p.id}.${o}`, { amount: money(p.amount ?? 0, l) })}</b>
              <small>{t(`event.${p.id}.${o}Hint`)}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorldPanel() {
  const state = useGameState();
  const { store } = game();
  const l = lang.value;
  const year = yearOf(state.day);
  const run = (ev: ReturnType<typeof store.dispatch>, ok: string) => {
    if (ev[0]?.type === 'rejected') toast(t(ev[0].reason === 'noCash' ? 'toast.noCash' : 'world.notNow'), 'warn');
    else if (ev.some((e) => e.type === ok)) sfx.fanfare();
  };
  const active = state.products.filter((p) => p.active && !p.madeToOrder);
  return (
    <>
      <h3 class="drawer-title">{t('world.title')} <small>{t('world.regions', { n: state.regions.entered.length })}</small></h3>
      {!state.phase4Ready && <p class="hint-line">{t('world.locked')}</p>}
      <div class="world-map">
        {REGIONS.map((r) => {
          const inside = state.regions.entered.includes(r.id);
          return (
            <div key={r.id} class={`region-pin ${inside ? 'in' : ''}`} style={{ left: `${r.map[0] * 100}%`, top: `${r.map[1] * 100}%` }}>
              {t(`region.${r.id}`)}
            </div>
          );
        })}
      </div>
      {REGIONS.map((r) => {
        const inside = state.regions.entered.includes(r.id);
        const stores = state.regions.stores[r.id] ?? 0;
        const tariff = state.events.active.some((e) => e.id === 'tariff' && e.target === r.id && state.day < e.until);
        return (
          <div class={`region-card ${inside ? 'in' : ''}`} key={r.id}>
            <div class="line-head">
              <b>{t(`region.${r.id}`)}</b>
              <span class="lvl">{t('world.share', { pct: Math.round(r.share * 100) })}</span>
            </div>
            <div class="muted">{t(`region.${r.id}Taste`)}</div>
            {tariff && <div class="warn-line">{t('world.tariff')}</div>}
            {inside ? (
              <div class="prod-stats">
                <span>{t('world.reach')}: <b>{decimal(regionReach(state, r.id) * 100, l, 0)}%</b></span>
                <span>{t('world.stores')}: <b>{stores}/{MAX_STORES}</b></span>
                {state.phase >= 4 && stores < MAX_STORES && (
                  <button class="btn-secondary" disabled={state.company.cash < storeCost(state, r.id)} onClick={() => run(store.dispatch({ type: 'openStore', region: r.id }), 'storeOpened')}>
                    {t('world.openStore', { amount: money(storeCost(state, r.id), l) })}
                  </button>
                )}
              </div>
            ) : (
              <button class="btn-secondary wide" disabled={!state.phase4Ready || state.company.cash < entryCost(state, r)} onClick={() => run(store.dispatch({ type: 'enterRegion', region: r.id }), 'regionEntered')}>
                {t('world.enter', { amount: money(entryCost(state, r), l) })}
              </button>
            )}
          </div>
        );
      })}

      <h4 class="drawer-sub">{t('world.contracts')}</h4>
      {state.phase < 4 && <p class="muted">{t('world.contractsLocked')}</p>}
      {state.phase >= 4 && state.contracts.offers.length === 0 && <p class="muted">{t('world.noContracts')}</p>}
      {state.contracts.offers.map((c) => {
        const weeks = Math.ceil((c.deadline - state.day) / 7);
        const fits = active.map((p) => ({ p, problem: contractProblem(state, c, p, currentReview(p, year)) }));
        const ok = fits.find((f) => !f.problem);
        const near = fits.find((f) => f.problem !== 'segment');
        return (
          <div class="line-card contract" key={c.id}>
            <div class="line-head">
              <b>{t(`client.${c.client}`)}</b>
              <span class={`lvl ${weeks < 0 ? 'neg' : ''}`}>{weeks >= 0 ? t('world.dueIn', { n: weeks }) : t('world.late', { n: -weeks })}</span>
            </div>
            <div class="prod-stats">
              <span>{shortNum(c.units, l)} × {t(`segment.${c.segment}`)}</span>
              <span>{t('world.minReview')}: <b>{decimal(c.minReview, l)}</b></span>
              <span>{t('world.maxCost')}: <b>{money(c.maxCost, l)}</b></span>
            </div>
            <div class="contract-pay">{money(contractValue(state, c, ok ? currentReview(ok.p, year) : c.minReview), l)}</div>
            {ok ? (
              <button class="btn-primary" onClick={() => run(store.dispatch({ type: 'fulfilContract', id: c.id, productId: ok.p.id }), 'contractDone')}>
                {t('world.deliver', { name: ok.p.design.name })}
              </button>
            ) : (
              <div class="hint-line">{near ? t(`world.problem.${near.problem}`, { name: near.p.design.name }) : t('world.problem.segment', { name: '' })}</div>
            )}
            <button class="btn-secondary danger small-btn" onClick={() => (store.dispatch({ type: 'declineContract', id: c.id }), sfx.click())}>{t('world.decline')}</button>
          </div>
        );
      })}
    </>
  );
}
