// Phase 5 (GDD §15): campus, own chip and OS, side products, takeovers.

import { useState } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { CAMPUS_LEVELS, chipProjectCost, osProjectCost, SIDE_KINDS, SIDE_PRICE, SIDE_PRODUCTS, type SidePrice } from '../../data/giant';
import { COMPETITORS } from '../../data/market';
import type { Tier } from '../../data/parts';
import { valuation } from '../../sim/game';
import { campusCost, canAcquire, osEcosystem, osQuality, osScore, ownChipRatio, rivalValue, sideReview, sideUnitsWeek } from '../../sim/giant';
import { yearOf } from '../../sim/time';
import { inflation } from '../../data/eras';
import { decimal, money, shortNum } from '../format';
import { game, toast, useGameState } from '../game';
import { lang, t } from '../i18n';

const TIERS: Tier[] = ['lite', 'std', 'pro'];
const PRICES = Object.keys(SIDE_PRICE) as SidePrice[];

function run(ev: ReturnType<ReturnType<typeof game>['store']['dispatch']>) {
  if (ev[0]?.type === 'rejected') toast(t(ev[0].reason === 'noCash' ? 'toast.noCash' : 'empire.notNow'), 'warn');
  else if (ev.length) sfx.fanfare();
}

export function EmpirePanel() {
  const state = useGameState();
  const { store } = game();
  const l = lang.value;
  const g = state.giant;
  const year = yearOf(state.day);
  const inf = inflation(Math.floor(year));
  const campus = campusCost(state);
  const own = valuation(state);
  // Price level for the next launch, per product kind.
  const [launchPrice, setLaunchPrice] = useState<Record<string, SidePrice>>({});
  if (!state.phase5Ready) {
    return (
      <>
        <h3 class="drawer-title">{t('empire.title')}</h3>
        <p class="hint-line">{t('empire.locked')}</p>
      </>
    );
  }
  const chipNext = chipProjectCost(g.chip.level);
  const osNext = osProjectCost(g.os.level);
  return (
    <>
      <h3 class="drawer-title">{t('empire.title')} <small>{t('empire.campusLevel', { n: g.campus })}</small></h3>
      <div class="building">
        <div>
          <b>{g.campus ? t('empire.campusNext', { n: g.campus + 1 }) : t('empire.campus')}</b>
          <div class="muted">{t('empire.campusDesc', { pct: Math.round((CAMPUS_LEVELS[g.campus]?.bonus ?? 0) * 100) })}</div>
        </div>
        {campus !== null ? (
          <button class="btn-secondary" disabled={state.company.cash < campus} onClick={() => run(store.dispatch({ type: 'buildCampus' }))}>{money(campus, l)}</button>
        ) : (
          <span class="node-note ok">{t('team.maxed')}</span>
        )}
      </div>

      <h4 class="drawer-sub">{t('empire.chip')}</h4>
      <div class="line-card">
        <div class="line-head">
          <b>{g.chip.level ? t('empire.chipName', { name: state.company.name, n: g.chip.level }) : t('empire.noChip')}</b>
          {g.chip.level > 0 && <span class="lvl">{t('empire.chipPower', { pct: Math.round(ownChipRatio(state) * 100) })}</span>}
        </div>
        <div class="muted">{t('empire.chipDesc')}</div>
        {g.chip.project ? (
          <>
            <div class="bar light"><i style={{ width: `${(g.chip.project.progress / g.chip.project.need) * 100}%`, background: 'var(--tech)' }} /></div>
            <span class="muted">{t('empire.inProgress')}</span>
          </>
        ) : (
          <button class="btn-secondary" disabled={g.campus < 1 || state.company.cash < chipNext.money * inf} onClick={() => run(store.dispatch({ type: 'startChip' }))}>
            {t('empire.startChip', { n: g.chip.level + 1, amount: money(chipNext.money * inf, l) })}
          </button>
        )}
        {g.chip.level > 0 && (
          <label class="toggle-line">
            <input type="checkbox" checked={g.chip.licensing} onChange={(e) => store.dispatch({ type: 'setLicensing', what: 'chip', on: (e.target as HTMLInputElement).checked })} />
            {t('empire.licenceChip')} {g.chip.licensees.length > 0 && <b>· {g.chip.licensees.map((id) => COMPETITORS.find((c) => c.id === id)?.name).join(', ')}</b>}
          </label>
        )}
      </div>

      <h4 class="drawer-sub">{t('empire.os')}</h4>
      <div class="line-card">
        <div class="line-head">
          <b>{g.os.level ? t('empire.osName', { name: state.company.name, n: g.os.level }) : t('empire.noOs')}</b>
          {g.os.level > 0 && <span class="lvl">{t('empire.osScore', { score: decimal(osScore(state), l, 1) })}</span>}
        </div>
        {g.os.level > 0 && (
          <div class="prod-stats">
            <span>{t('empire.osQuality')}: <b>{decimal(osQuality(state), l, 1)}</b></span>
            <span>{t('empire.osApps')}: <b>{decimal(osEcosystem(state), l, 1)}</b></span>
            <span>{t('empire.osBase')}: <b>{shortNum(g.os.installed, l)}</b></span>
          </div>
        )}
        <div class="muted">{t('empire.osDesc')}</div>
        {g.os.project ? (
          <>
            <div class="bar light"><i style={{ width: `${(g.os.project.progress / g.os.project.need) * 100}%`, background: 'var(--software)' }} /></div>
            <span class="muted">{t('empire.inProgress')}</span>
          </>
        ) : (
          <button class="btn-secondary" disabled={g.campus < 1 || state.company.cash < osNext.money * inf} onClick={() => run(store.dispatch({ type: 'startOs' }))}>
            {t('empire.startOs', { n: g.os.level + 1, amount: money(osNext.money * inf, l) })}
          </button>
        )}
        {g.os.level > 0 && (
          <label class="toggle-line">
            <input type="checkbox" checked={g.os.licensing} onChange={(e) => store.dispatch({ type: 'setLicensing', what: 'os', on: (e.target as HTMLInputElement).checked })} />
            {t('empire.licenceOs')} {g.os.licensees.length > 0 && <b>· {g.os.licensees.length}</b>}
          </label>
        )}
        {g.licenceWeek > 0 && <div class="good-line">{t('empire.licenceIncome', { amount: money(g.licenceWeek, l) })}</div>}
      </div>

      <h4 class="drawer-sub">{t('empire.side')}</h4>
      {SIDE_KINDS.map((kind) => {
        const def = SIDE_PRODUCTS[kind];
        const p = g.side[kind];
        const open = year >= def.year;
        return (
          <div class="line-card" key={kind}>
            <div class="line-head">
              <b>{t(`empire.kind.${kind}`)}</b>
              {p && <span class="lvl">{t('empire.gen', { n: p.gen })} · {decimal(sideReview(state, p), l, 1)}</span>}
            </div>
            {p && (
              <div class="prod-stats">
                <span>{t('empire.perWeek', { n: shortNum(sideUnitsWeek(state, kind), l) })}</span>
                <span>{t('empire.revenue')}: <b>{money(p.revenue, l)}</b></span>
              </div>
            )}
            {open && (
              <div class="seg-mini">
                <span class="muted">{t('empire.price')}</span>
                {PRICES.map((pr) => {
                  const cur = p ? (p.priceLevel as SidePrice) : (launchPrice[kind] ?? 'normal');
                  return (
                    <button
                      key={pr}
                      class={cur === pr ? 'on' : ''}
                      onClick={() => (p ? store.dispatch({ type: 'setSidePrice', kind, price: pr }) : setLaunchPrice({ ...launchPrice, [kind]: pr }))}
                    >
                      {t(`empire.priceLevel.${pr}`)} <small>{money(def.anchor * SIDE_PRICE[pr] * inf, l)}</small>
                    </button>
                  );
                })}
              </div>
            )}
            {!open ? (
              <span class="muted">{t('empire.from', { year: def.year })}</span>
            ) : (
              <div class="side-launch">
                {TIERS.map((tier) => (
                  <button key={tier} class="btn-secondary" disabled={state.phase < 5} onClick={() => run(store.dispatch({ type: 'launchSide', kind, tier, price: p ? (p.priceLevel as SidePrice) : (launchPrice[kind] ?? 'normal') }))}>
                    {t(`tier.${tier}`)} · {money(def.dev * inf * (1 + 0.5 * TIERS.indexOf(tier)), l)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p class="hint-line">{t('empire.priceHint')} {t('empire.ecosystem')}</p>

      <h4 class="drawer-sub">{t('empire.takeovers')}</h4>
      {state.rivals.map((r) => {
        const def = COMPETITORS.find((c) => c.id === r.id)!;
        const bought = g.acquired.includes(r.id);
        const ok = canAcquire(state, r.id, own);
        return (
          <div class="rival" key={r.id}>
            <div class="rival-head">
              <span class="dot" style={{ background: def.color }} />
              <b>{def.name}</b>
              <span class="muted">{t('hud.brand')} {Math.round(r.brand)}</span>
              {bought ? (
                <span class="badge">{t('empire.yours')}</span>
              ) : ok ? (
                <button class="btn-secondary small-btn" onClick={() => run(store.dispatch({ type: 'acquire', id: r.id }))}>
                  {t('empire.buy', { amount: money(rivalValue(state, r.id) * 1.3, l) })}
                </button>
              ) : (
                <span class="muted">{t('empire.tooStrong')}</span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
