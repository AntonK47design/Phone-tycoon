// Factory tab (GDD §9): build the factory, lines, tempo, warehouse.

import { sfx } from '../../audio/sfx';
import { colorById } from '../../data/design';
import { MAX_LINE_LEVEL, TEMPOS, warehouseCapacity, type Tempo } from '../../data/factory';
import type { SimEvent } from '../../sim/events';
import {
  buildFactoryCost,
  factorySizeCost,
  lineRate,
  lineScrapRate,
  lineUpgradeCost,
  maxLines,
  newLineCost,
  stockTotal,
  warehouseCost,
} from '../../sim/factory';
import { currentDemand } from '../../sim/game';
import { unitCost } from '../../sim/economy/market';
import { yearOf } from '../../sim/time';
import { decimal, money, shortNum } from '../format';
import { game, toast, useGameState } from '../game';
import { lang, t } from '../i18n';

const TEMPO_LIST: Tempo[] = ['quality', 'normal', 'speed'];

function run(ev: SimEvent[], sound = () => sfx.fanfare()) {
  const e = ev[0];
  if (e?.type === 'rejected') toast(t(e.reason === 'noCash' ? 'toast.noCash' : 'factory.notNow'), 'warn');
  else if (e) sound();
}

export function FactoryPanel() {
  const state = useGameState();
  const { store } = game();
  const l = lang.value;
  const f = state.factory;
  const year = yearOf(state.day);

  if (f.size === 0) {
    const cost = buildFactoryCost(state);
    return (
      <>
        <h3 class="drawer-title">{t('factory.title')}</h3>
        <p>{t('factory.pitch')}</p>
        <ul class="factory-points">
          <li>{t('factory.point1')}</li>
          <li>{t('factory.point2')}</li>
          <li>{t('factory.point3')}</li>
        </ul>
        {state.phase3Ready ? (
          <button class="btn-primary factory-build" disabled={state.company.cash < cost} onClick={() => run(store.dispatch({ type: 'buildFactory' }))}>
            {t('factory.build', { amount: money(cost, l) })}
          </button>
        ) : (
          <p class="hint-line">{t('factory.locked')}</p>
        )}
      </>
    );
  }

  const products = state.products.filter((p) => p.active && !p.madeToOrder);
  const stock = stockTotal(state);
  const cap = warehouseCapacity(f.warehouse);
  const add = newLineCost(state);
  const grow = factorySizeCost(state);
  const cycle = (lineId: number, current: number | null) => {
    const ids = [null, ...products.map((p) => p.id)];
    const next = ids[(ids.indexOf(current) + 1) % ids.length];
    store.dispatch({ type: 'assignLine', id: lineId, productId: next });
    sfx.click();
  };
  return (
    <>
      <h3 class="drawer-title">
        {t('factory.title')} <small>{t('factory.lines', { n: f.lines.length, max: maxLines(state) })}</small>
      </h3>
      <div class="field">
        <span class="label">{t('factory.tempo')}</span>
        <div class="seg">
          {TEMPO_LIST.map((tp) => (
            <button key={tp} class={f.tempo === tp ? 'on' : ''} data-tip={t(`factory.tempoTip.${tp}`)} onClick={() => (store.dispatch({ type: 'setTempo', tempo: tp }), sfx.click())}>
              {t(`factory.tempoName.${tp}`)}
            </button>
          ))}
        </div>
        <span class="hint-line">
          {t('factory.tempoInfo', { speed: Math.round(TEMPOS[f.tempo].speed * 100), scrap: Math.round(TEMPOS[f.tempo].scrap * 100) })}
        </span>
      </div>
      <div class="field">
        <span class="label">{t('factory.target')}</span>
        <div class="seg">
          {[2, 4, 8].map((w) => (
            <button key={w} class={f.targetWeeks === w ? 'on' : ''} onClick={() => (store.dispatch({ type: 'setTargetWeeks', weeks: w }), sfx.click())}>
              {t('factory.weeks', { n: w })}
            </button>
          ))}
        </div>
      </div>

      <h4 class="drawer-sub">{t('factory.linesTitle')}</h4>
      {f.lines.map((line, i) => {
        const p = products.find((x) => x.id === line.productId) ?? null;
        const rate = lineRate(state, line) * 7;
        const scrap = lineScrapRate(state, line);
        const up = lineUpgradeCost(state, line);
        const demand = p ? currentDemand(state, p) : 0;
        return (
          <div class="line-card" key={line.id}>
            <div class="line-head">
              <b>{t('factory.line', { n: i + 1 })}</b>
              <span class="lvl">{t('factory.level', { n: line.level, max: MAX_LINE_LEVEL })}</span>
            </div>
            <button class="line-product" data-tip={t('factory.cycleTip')} onClick={() => cycle(line.id, line.productId)}>
              <span class="dot" style={{ background: p ? colorById(p.design.colorId)?.hex : '#bbb' }} />
              {p ? p.design.name : t('factory.idle')}
              <span class="muted">▸</span>
            </button>
            <div class="prod-stats">
              <span>{t('factory.capacity')}: <b>{shortNum(rate, l)}/{t('loan.wk')}</b></span>
              <span>{t('factory.built')}: <b>{shortNum(line.lastWeek, l)}</b></span>
              <span>{t('factory.scrap')}: <b class={scrap > 0.03 ? 'neg' : ''}>{decimal(scrap * 100, l, 1)}%</b></span>
              {p && <span>{t('factory.unit')}: <b>{money(unitCost(p.design, year, 'factory', line.level), l)}</b></span>}
            </div>
            {p && demand > rate && <div class="warn-line">{t('factory.tooSlow', { demand: shortNum(demand, l) })}</div>}
            <div class="prod-actions">
              <button class="btn-secondary" onClick={() => (store.dispatch({ type: 'pauseLine', id: line.id, paused: !line.paused }), sfx.click())}>
                {line.paused ? t('factory.resume') : t('factory.pause')}
              </button>
              {up !== null && (
                <button class="btn-secondary" disabled={state.company.cash < up} onClick={() => run(store.dispatch({ type: 'upgradeLine', id: line.id }))}>
                  {t('factory.upgrade', { amount: money(up, l) })}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {add !== null && (
        <button class="btn-secondary wide" disabled={state.company.cash < add} onClick={() => run(store.dispatch({ type: 'addLine' }))}>
          {t('factory.addLine', { amount: money(add, l) })}
        </button>
      )}
      {add === null && grow !== null && (
        <button class="btn-secondary wide" disabled={state.company.cash < grow} onClick={() => run(store.dispatch({ type: 'growFactory' }))}>
          {t('factory.grow', { amount: money(grow, l), lines: [2, 4, 8][f.size] })}
        </button>
      )}

      <h4 class="drawer-sub">{t('factory.warehouse')}</h4>
      <div class="kpis">
        <div class="kpi"><span class="label">{t('factory.inStock')}</span><b class={stock > cap ? 'neg' : ''}>{shortNum(stock, l)} / {shortNum(cap, l)}</b></div>
        <div class="kpi"><span class="label">{t('factory.totalBuilt')}</span><b>{shortNum(f.produced, l)}</b></div>
      </div>
      <div class="bar light"><i style={{ width: `${Math.min(100, (stock / cap) * 100)}%`, background: stock > cap ? 'var(--red)' : 'var(--orange)' }} /></div>
      {stock > cap && <div class="warn-line">{t('factory.overflow')}</div>}
      <button class="btn-secondary wide" disabled={state.company.cash < warehouseCost(state)} onClick={() => run(store.dispatch({ type: 'upgradeWarehouse' }))}>
        {t('factory.warehouseUp', { amount: money(warehouseCost(state), l), cap: shortNum(warehouseCapacity(f.warehouse + 1), l) })}
      </button>
      <p class="hint-line">{t('factory.howItWorks')}</p>
    </>
  );
}
