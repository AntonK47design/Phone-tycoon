// Phase-2 side panels: Company, Team, Research, Market.

import { sfx } from '../../audio/sfx';
import { LAB_BUDGETS, LAB_COST_PER_RP, OEM_MIN_BATCH } from '../../data/components';
import { colorById } from '../../data/design';
import { expectedDisplaySize, expectedTech, expectedThickness, eraForYear, inflation } from '../../data/eras';
import { GOALS } from '../../data/goals';
import { COMPETITORS, SEGMENTS, type Segment } from '../../data/market';
import { FEATURES } from '../../data/parts';
import { BRANCHES, RESEARCH } from '../../data/research';
import { creditAvailable, currentDemand, marketShare, valuation } from '../../sim/game';
import { marketSize } from '../../sim/economy/market';
import { goalProgress, visibleGoals } from '../../sim/goals';
import { channelCut, reach, researchCost, researchProgress, researchStatus, rpPerDay } from '../../sim/research';
import { priceAnchor } from '../../sim/scoring/score';
import type { GameState } from '../../sim/state';
import { calendar, yearOf } from '../../sim/time';
import { decimal, money, shortNum } from '../format';
import { drawer, game, hubView, toast, useGameState, type DrawerTab } from '../game';
import { seats } from '../../sim/team';
import { TeamPanel } from './TeamPanel';
import { lang, t } from '../i18n';
import { IconClose } from '../icons';
import { researchEffect, researchName, researchNameById } from '../labels';

export function DrawerTabs() {
  const state = useGameState();
  if (state.phase < 2) return null;
  const tabs: DrawerTab[] = ['company', 'team', 'research', 'market'];
  const busy = researchProgress(state);
  return (
    <div class="tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          class={`tab ${drawer.value === tab ? 'on' : ''}`}
          onClick={() => {
            sfx.click();
            drawer.value = drawer.value === tab ? null : tab;
            // The team lives in the office: show it.
            if (drawer.value === 'team' && hubView.value !== 'office') {
              hubView.value = 'office';
              game().engine.goToView('office', 1.2);
            }
          }}
        >
          {t(`tabs.${tab}`)}
          {tab === 'research' && !busy && <i class="dot-alert" />}
          {tab === 'team' && state.team.staff.length < seats(state) && state.team.applicants.length > 0 && state.team.staff.length < 2 && <i class="dot-alert" />}
        </button>
      ))}
    </div>
  );
}

export function Drawer() {
  const state = useGameState();
  const tab = drawer.value;
  if (!tab || state.phase < 2) return null;
  return (
    <div class="drawer paper" key={tab}>
      <button class="icon-btn drawer-close" aria-label="close" onClick={() => ((drawer.value = null), sfx.click())}>
        <IconClose />
      </button>
      {tab === 'company' && <CompanyPanel state={state} />}
      {tab === 'team' && <TeamPanel state={state} />}
      {tab === 'research' && <ResearchPanel state={state} />}
      {tab === 'market' && <MarketPanel state={state} />}
    </div>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div class="spark empty" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const w = 220;
  const h = 46;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`).join(' ');
  const zero = h - ((0 - min) / (max - min || 1)) * (h - 4) - 2;
  return (
    <svg class="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1="0" x2={w} y1={zero} y2={zero} stroke="currentColor" stroke-opacity=".25" stroke-dasharray="4 4" />
      <polyline points={pts} fill="none" stroke={color} stroke-width="3" stroke-linejoin="round" />
    </svg>
  );
}

function CompanyPanel({ state }: { state: GameState }) {
  const { store } = game();
  const l = lang.value;
  const last = (arr: number[]) => arr[arr.length - 1] ?? 0;
  const products = state.products.filter((p) => p.active);
  const gate = GOALS.find((g) => g.gate === 'phase3')!;
  const order = (id: number, units: number) => {
    const ev = store.dispatch({ type: 'orderBatch', productId: id, units });
    if (ev[0]?.type === 'orderPlaced') sfx.coin(0.8);
    else toast(t('toast.noCash'), 'warn');
  };
  return (
    <>
      <h3 class="drawer-title">{state.company.name}</h3>
      <div class="kpis">
        <div class="kpi"><span class="label">{t('company.valuation')}</span><b>{money(valuation(state), l)}</b></div>
        <div class="kpi"><span class="label">{t('company.cash')}</span><b>{money(state.company.cash, l)}</b></div>
        <div class="kpi"><span class="label">{t('company.debt')}</span><b class={state.company.debt > 0 ? 'neg' : ''}>{money(state.company.debt, l)}</b></div>
        <div class="kpi"><span class="label">{t('company.credit')}</span><b>{money(creditAvailable(state), l)}</b></div>
        <div class="kpi"><span class="label">{t('company.reach')}</span><b>{decimal(reach(state) * 100, l, 2)}%</b></div>
        <div class="kpi"><span class="label">{t('company.channel')}</span><b>{Math.round(channelCut(state) * 100)}%</b></div>
      </div>
      <div class="chart-block">
        <div class="label">{t('company.profit')} · {money(last(state.history.profit), l)}</div>
        <Spark values={state.history.profit} color="var(--orange)" />
        <div class="label">{t('company.revenue')} · {money(last(state.history.revenue), l)}</div>
        <Spark values={state.history.revenue} color="var(--blue)" />
      </div>
      <h4 class="drawer-sub">{t('company.products')}</h4>
      {products.length === 0 && <p class="muted">{t('company.none')}</p>}
      {products.map((p) => {
        const demand = Math.round(currentDemand(state, p));
        const incoming = p.orders.reduce((a, o) => a + o.units, 0);
        const four = Math.max(OEM_MIN_BATCH, Math.round((demand * 4) / 50) * 50);
        return (
          <div class="prod-card" key={p.id}>
            <div class="prod-head">
              <span class="dot" style={{ background: colorById(p.design.colorId)?.hex }} />
              <b>{p.design.name}</b>
              <span class="muted">{t(`segment.${p.design.segment}`)} · {money(p.design.price, l)}</span>
            </div>
            {p.madeToOrder ? (
              <div class="prod-stats"><span>{t('products.sold', { n: shortNum(p.unitsSold, l) })}</span></div>
            ) : (
              <>
                <div class="prod-stats">
                  <span>{t('company.stock')}: {p.stock > 0 ? <b>{shortNum(p.stock, l)}</b> : <b class="sold-out">{t('company.soldOut')}</b>}</span>
                  <span>{t('company.demand')}: <b>{shortNum(demand, l)}/wk</b></span>
                  {p.backlog >= 1 && <span>{t('company.backlog')}: <b>{shortNum(p.backlog, l)}</b></span>}
                  {incoming > 0 && <span>{t('company.incoming')}: <b>{shortNum(incoming, l)}</b></span>}
                </div>
                {demand > 0 && p.stock > demand * 10 && (
                  <div class="warn-line">{t('company.overstock', { weeks: Math.round(p.stock / demand) })}</div>
                )}
                <div class="prod-actions">
                  <button class="btn-secondary" onClick={() => order(p.id, four)}>{t('company.reorder', { n: shortNum(four, l) })}</button>
                  <button class="btn-secondary danger" onClick={() => (store.dispatch({ type: 'discontinue', productId: p.id }), sfx.click())}>
                    {t('company.discontinue')}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
      {!state.phase3Ready && (
        <p class="muted">
          {t('company.phase3', { goal: t(`goals.${visibleGoals(state).find((g) => g.gate === 'phase3')?.id ?? gate.id}`) })}
          {' · '}
          {money(Math.max(0, gate.target - goalProgress(state, gate)), l)}
        </p>
      )}
    </>
  );
}

function ResearchPanel({ state }: { state: GameState }) {
  const { store } = game();
  const l = lang.value;
  const year = yearOf(state.day);
  const cur = researchProgress(state);
  const r = reach(state);
  const start = (id: string) => {
    const ev = store.dispatch({ type: 'startResearch', id });
    if (ev[0]?.type === 'researchStarted') sfx.whoosh();
    else if (ev[0]?.type === 'rejected' && ev[0].reason === 'noCash') toast(t('toast.noCash'), 'warn');
  };
  return (
    <>
      <h3 class="drawer-title">{t('research.title')} <small>{t('research.rpDay', { n: decimal(rpPerDay(state), l) })}</small></h3>
      <div class="field lab-budget">
        {t('research.budget')}
        <div class="seg">
          {LAB_BUDGETS.map((b) => {
            const amount = Math.round(b * inflation(Math.floor(year)));
            return (
              <button key={b} class={Math.abs(state.research.budget - amount) < 1 ? 'on' : ''} onClick={() => (store.dispatch({ type: 'setLabBudget', amount }), sfx.click())}>
                {b === 0 ? '0' : shortNum(amount, l)}
              </button>
            );
          })}
        </div>
        <span class="hint-line">{t('research.budgetHint', { amount: money(LAB_COST_PER_RP * inflation(Math.floor(year)), l) })}</span>
      </div>
      <div class="research-now">
        {cur ? (
          <>
            <span class="label">{t('research.current')}</span>
            <b>{researchName(cur.node)}</b>
            <div class="bar light"><i style={{ width: `${(cur.progress / cur.need) * 100}%`, background: 'var(--orange)' }} /></div>
            <span class="muted">{t('research.daysLeft', { days: cur.daysLeft })} · {researchEffect(cur.node, r)}</span>
          </>
        ) : (
          <span>{t('research.none')}</span>
        )}
      </div>
      {BRANCHES.map((branch) => {
        const nodes = RESEARCH.filter((n) => n.branch === branch)
          .filter((n) => researchStatus(state, n) !== 'done' || n.year >= year - 1)
          .slice(0, 4);
        if (!nodes.length) return null;
        return (
          <div class="branch" key={branch}>
            <h4 class="drawer-sub">{t(`research.branch.${branch}`)}</h4>
            <div class="nodes">
              {nodes.map((n) => {
                const st = researchStatus(state, n);
                const cost = researchCost(n, year);
                const pioneer = n.year > year;
                return (
                  <div class={`node ${st}`} key={n.id}>
                    <div class="node-head">
                      <b>{researchName(n)}</b>
                      <span class="node-year">{n.year}</span>
                    </div>
                    <div class="node-eff">{researchEffect(n, r)}</div>
                    {st === 'available' && (
                      <button class="btn-secondary node-go" disabled={!!state.research.current} onClick={() => start(n.id)}>
                        {t('research.start')} · {money(cost.money, l)} · {cost.rp} RP
                      </button>
                    )}
                    {st === 'available' && pioneer && <div class="node-note">{t('research.pioneer', { pct: `${Math.round((cost.rp / n.rp - 1) * 100)}%` })}</div>}
                    {st === 'active' && <div class="node-note">{t('research.current')}</div>}
                    {st === 'done' && <div class="node-note ok">{t('research.done')}</div>}
                    {st === 'locked' && <div class="node-note">{t('research.locked', { list: n.requires.map(researchNameById).join(', ') })}</div>}
                    {st === 'tooEarly' && <div class="node-note">{t('research.tooEarly', { year: n.year - 1 })}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function MarketPanel({ state }: { state: GameState }) {
  const l = lang.value;
  const year = yearOf(state.day);
  const cal = calendar(state.day);
  const sum = (a: number[] | undefined) => (a ?? []).reduce((x, y) => x + y, 0);
  const rows = [
    { id: 'you', name: t('market.you'), units: sum(state.history.playerUnits), color: 'var(--orange)' },
    ...COMPETITORS.map((c) => ({ id: c.id, name: c.name, units: sum(state.history.compUnits[c.id]), color: c.color })),
    { id: '_rest', name: t('market.rest'), units: sum(state.history.compUnits._rest), color: '#9a9184' },
  ].sort((a, b) => b.units - a.units);
  const total = rows.reduce((a, r) => a + r.units, 0) || 1;
  const segs: Segment[] = ['budget', 'mid', 'flagship'];
  return (
    <>
      <h3 class="drawer-title">{t('market.title')} <small>{t(`era.${eraForYear(year).id}`)}</small></h3>
      <div class="kpis">
        <div class="kpi"><span class="label">{t('market.size')}</span><b>{shortNum(marketSize(year), l)}</b></div>
        <div class="kpi"><span class="label">{t('market.share')}</span><b>{decimal(marketShare(state) * 100, l, 2)}%</b></div>
      </div>
      <h4 class="drawer-sub">{t('market.ranking')}</h4>
      <div class="ranking">
        {rows.map((r, i) => (
          <div class={`rank ${r.id === 'you' ? 'me' : ''}`} key={r.id}>
            <span class="pos">{i + 1}</span>
            <span class="name">{r.name}</span>
            <div class="rank-bar"><i style={{ width: `${Math.max(0.5, (r.units / total) * 100)}%`, background: r.color }} /></div>
            <span class="pct">{decimal((r.units / total) * 100, l, 1)}%</span>
          </div>
        ))}
      </div>
      <h4 class="drawer-sub">{t('market.expect', { year: cal.year })}</h4>
      <table class="expect">
        <thead>
          <tr>
            <th />
            {segs.map((s) => <th key={s}>{t(`segment.${s}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t('market.techIdx')}</td>
            {segs.map((s) => <td key={s}>{Math.round(SEGMENTS[s].sigma * expectedTech(year))}</td>)}
          </tr>
          <tr>
            <td>{t('market.screen')}</td>
            {segs.map((s) => <td key={s}>{decimal(expectedDisplaySize(year) + SEGMENTS[s].sizeOffset, l)}″</td>)}
          </tr>
          <tr>
            <td>{t('market.thickness')}</td>
            {segs.map((s) => <td key={s}>{decimal(expectedThickness(year), l)} mm</td>)}
          </tr>
          <tr>
            <td>{t('editor.price')}</td>
            {segs.map((s) => <td key={s}>{money(priceAnchor({ segment: s }, year), l)}</td>)}
          </tr>
          <tr>
            <td>{t('market.features')}</td>
            {segs.map((s) => {
              const must = FEATURES.filter((f) => f.expected[s] <= year).map((f) => t(`feature.${f.id}`));
              return <td key={s}>{must.join(', ') || t('market.none')}</td>;
            })}
          </tr>
        </tbody>
      </table>
    </>
  );
}
