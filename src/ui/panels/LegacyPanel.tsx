// Endgame (GDD §16): Hall of Fame, achievements, prestige with legacy bonuses and scenarios.

import { createPortal } from 'preact/compat';
import { useState } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { newGame } from '../../sim/game';
import { ACHIEVEMENTS, bonusCost, LEGACY_BONUSES, legacyAfterPrestige, legacyPointsFor, SCENARIOS, scenarioUnlocked } from '../../sim/legacy';
import { decimal, money, shortNum } from '../format';
import { game, useGameState } from '../game';
import { lang, t } from '../i18n';

function hallValue(kind: string, value: number, l: 'en' | 'de'): string {
  if (kind === 'bestReview') return decimal(value, l, 1);
  if (kind === 'peakValuation') return money(value, l);
  return shortNum(value, l);
}

export function LegacyPanel() {
  const state = useGameState();
  const l = lang.value;
  const [shop, setShop] = useState(false);
  const allHall = [...state.hall];
  for (const h of state.legacy.hall) if (!allHall.some((x) => x.kind === h.kind && x.value >= h.value)) allHall.push({ ...h, name: `${h.name} ★` });
  return (
    <>
      <h3 class="drawer-title">{t('legacy.title')} <small>{t('legacy.runs', { n: state.legacy.runs + 1 })}</small></h3>
      <h4 class="drawer-sub">{t('legacy.hall')}</h4>
      <div class="hall">
        {allHall.map((h, i) => (
          <div class="hall-row" key={i}>
            <span class="dot" style={{ background: h.color ?? 'var(--tape)' }} />
            <span class="hall-kind">{t(`legacy.record.${h.kind}`)}</span>
            <b>{h.name}</b>
            <span class="hall-val">{hallValue(h.kind, h.value, l)} · {h.year}</span>
          </div>
        ))}
        {allHall.length === 0 && <p class="muted">{t('legacy.noRecords')}</p>}
      </div>

      <h4 class="drawer-sub">{t('legacy.achievements', { n: state.legacy.achievements.length, max: ACHIEVEMENTS.length })}</h4>
      <div class="badges">
        {ACHIEVEMENTS.map((a) => {
          const got = state.legacy.achievements.includes(a.id) || state.achievements.includes(a.id);
          return (
            <div class={`ach ${got ? 'got' : ''}`} key={a.id} data-tip={t(`ach.${a.id}.desc`)}>
              <b>{got ? '★' : '☆'}</b> {t(`ach.${a.id}.name`)}
            </div>
          );
        })}
      </div>

      <h4 class="drawer-sub">{t('legacy.prestige')}</h4>
      <p class="muted">{t('legacy.prestigeDesc', { points: legacyPointsFor(state), have: state.legacy.points })}</p>
      {state.phase6Ready ? (
        <button class="btn-primary wide-primary" onClick={() => ((setShop(true)), sfx.click())}>{t('legacy.newCompany')}</button>
      ) : (
        <p class="hint-line">{t('legacy.locked')}</p>
      )}
      {/* Portal: the drawer's slide animation would clip a fixed dialog. */}
      {shop && createPortal(<PrestigeDialog close={() => setShop(false)} />, document.querySelector('.ui-layer') ?? document.body)}
    </>
  );
}

function PrestigeDialog({ close }: { close: () => void }) {
  const state = useGameState();
  const [buy, setBuy] = useState<Record<string, number>>({});
  const [scenario, setScenario] = useState<string | null>(null);
  const earned = legacyPointsFor(state);
  let points = state.legacy.points + earned;
  const levels: Record<string, number> = {};
  for (const b of LEGACY_BONUSES) {
    let lvl = state.legacy.bonuses[b.id] ?? 0;
    for (let i = 0; i < (buy[b.id] ?? 0); i++) {
      points -= bonusCost(lvl);
      lvl++;
    }
    levels[b.id] = lvl;
  }
  const merged = { ...state.legacy, achievements: [...new Set([...state.legacy.achievements, ...state.achievements])] };
  const go = () => {
    const legacy = legacyAfterPrestige(state, buy, scenario);
    sfx.fanfare();
    game().startOver(newGame((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0, legacy));
  };
  return (
    <div class="modal-back">
      <div class="paper modal prestige">
        <h3>{t('legacy.shopTitle')}</h3>
        <p class="muted">{t('legacy.shopDesc', { points })}</p>
        {LEGACY_BONUSES.map((b) => {
          const lvl = levels[b.id];
          const can = lvl < b.max && points >= bonusCost(lvl);
          return (
            <div class="shop-row" key={b.id}>
              <div>
                <b>{t(`legacy.bonus.${b.id}`)}</b> <span class="muted">{lvl}/{b.max}</span>
              </div>
              <button class="btn-secondary" disabled={!can} onClick={() => setBuy({ ...buy, [b.id]: (buy[b.id] ?? 0) + 1 })}>
                +1 · {bonusCost(lvl)} LP
              </button>
            </div>
          );
        })}
        <h4 class="drawer-sub">{t('legacy.scenario')}</h4>
        <div class="seg scenario-seg">
          <button class={scenario === null ? 'on' : ''} onClick={() => setScenario(null)}>{t('legacy.scen.classic')}</button>
          {SCENARIOS.map((s) => {
            const open = scenarioUnlocked(merged, s.id);
            return (
              <button key={s.id} class={scenario === s.id ? 'on' : ''} disabled={!open} data-tip={open ? t(`legacy.scen.${s.id}Desc`) : t('legacy.scen.lockedBy', { ach: t(`ach.${s.unlock}.name`) })} onClick={() => setScenario(s.id)}>
                {t(`legacy.scen.${s.id}`)}
              </button>
            );
          })}
        </div>
        <div class="warn-line">{t('legacy.warning')}</div>
        <div class="modal-actions">
          <button class="btn-secondary" onClick={close}>{t('legacy.cancel')}</button>
          <button class="btn-primary" onClick={go}>{t('legacy.found')}</button>
        </div>
      </div>
    </div>
  );
}
