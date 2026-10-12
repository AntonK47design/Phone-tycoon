// Phase-2 launch planning: first production run, marketing budget, launch event.

import { useMemo, useState } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { OEM_MIN_BATCH, PRESENTATIONS } from '../../data/components';
import { creditAvailable, forecast, launchQuote, marketingScale } from '../../sim/game';
import { canMarket, presentationLevel } from '../../sim/research';
import { money, shortNum } from '../format';
import { game, launchSetupOpen, useGameState } from '../game';
import { lang, t } from '../i18n';
import { startLaunch } from './flow';

export function LaunchSetup() {
  const state = useGameState();
  const l = lang.value;
  const design = state.dev!.design;
  const base = useMemo(() => forecast(state, design, { batch: 1000 }), [state.day]);
  // With an own factory the lines build the stock; an extra contract batch is optional.
  const hasFactory = state.factory.lines.length > 0;
  const [weeks, setWeeks] = useState(hasFactory ? 0 : 5);
  const scale = marketingScale(state);
  const [mkt, setMkt] = useState(canMarket(state) ? Math.round(scale) : 0);
  const [stage, setStage] = useState(0);

  const weekly = Math.max(1, base.weeklyUnits);
  const batch = weeks === 0 ? 0 : Math.max(OEM_MIN_BATCH, Math.round((weekly * weeks) / 50) * 50);
  const opts = { batch, marketing: mkt, presentation: stage };
  const quote = launchQuote(state, design, opts);
  const fc = forecast(state, design, opts);
  const cashNeeded = quote.total - quote.batchCost;
  const borrowed = Math.max(0, quote.total - state.company.cash);
  const affordable = cashNeeded <= state.company.cash && borrowed <= Math.max(creditAvailable(state), batch === OEM_MIN_BATCH ? quote.batchCost : 0);
  const overhype = 5 + (4 * quote.hype) / 100 > fc.review + 0.5;
  const maxStage = presentationLevel(state);

  const go = () => {
    if (!affordable) return;
    sfx.click();
    launchSetupOpen.value = false;
    startLaunch(opts);
  };
  const close = () => {
    sfx.click();
    launchSetupOpen.value = false;
  };

  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="glass modal launch-setup" role="dialog" aria-label={t('launchSetup.title')}>
        <h3>{t('launchSetup.title')} · {design.name}</h3>

        <div class="field">
          {t('launchSetup.batch')}
          <div class="slider-row">
            <input class="slider" type="range" min={hasFactory ? 0 : 1} max={16} step={1} value={weeks} onInput={(e) => setWeeks(Number((e.target as HTMLInputElement).value))} />
            <b>{batch ? shortNum(batch, l) : t('launchSetup.factoryOnly')}</b>
          </div>
          <span class="hint-line">
            {batch ? `${t('launchSetup.weeks', { n: weeks })} · ${money(quote.batchCost, l)}` : t('launchSetup.factoryHint')}
          </span>
        </div>

        {weeks > 8 && <div class="warn-line">{t('launchSetup.bigBatch')}</div>}

        <div class="field">
          {t('launchSetup.marketing')}
          {canMarket(state) ? (
            <div class="slider-row">
              <input
                class="slider"
                type="range"
                min={0}
                max={Math.round(scale * 8)}
                step={Math.max(100, Math.round(scale / 10 / 100) * 100)}
                value={mkt}
                onInput={(e) => setMkt(Number((e.target as HTMLInputElement).value))}
              />
              <b>{money(mkt, l)}</b>
            </div>
          ) : (
            <span class="hint-line">{t('launchSetup.noMarketing')}</span>
          )}
        </div>

        {maxStage > 0 && (
          <div class="field">
            {t('launchSetup.stage')}
            <div class="seg">
              {PRESENTATIONS.slice(0, maxStage + 1).map((p) => (
                <button key={p.level} class={stage === p.level ? 'on' : ''} onClick={() => (setStage(p.level), sfx.click())}>
                  {t(`launchSetup.stage${p.level}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div class="hype-meter" data-tip={t('tip.review')}>
          <span class="label">{t('launchSetup.hype')}</span>
          <div class="bar">
            <i style={{ width: `${quote.hype}%`, background: overhype ? 'var(--red)' : 'var(--orange)' }} />
          </div>
          <b>{Math.round(quote.hype)}</b>
        </div>
        {overhype && <div class="warn-line">{t('launchSetup.overhype')}</div>}

        <div class="stat-row light">
          <span class="k">{t('editor.review')}</span>
          <b>{fc.review.toFixed(1)}</b>
        </div>
        <div class="stat-row light">
          <span class="k">{t('editor.weekly')}</span>
          <b>{t('editor.weeklyValue', { n: shortNum(fc.weeklyUnits, l) })}</b>
        </div>
        <div class="stat-row light total">
          <span class="k">{t('launchSetup.total')}</span>
          <b>{money(quote.total, l)}</b>
        </div>
        {borrowed > 0 && affordable && <div class="hint-line">{t('launchSetup.credit', { amount: money(borrowed, l) })}</div>}
        {!affordable && <div class="warn-line">{t('launchSetup.tooPoor')}</div>}

        <div class="modal-actions">
          <button class="btn-secondary" onClick={close}>{t('launchSetup.cancel')}</button>
          <button class="btn-primary btn-launch" disabled={!affordable} onClick={go}>
            {t('launchSetup.go')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function openLaunchSetup() {
  const { store } = game();
  if (store.getState().phase >= 2) {
    sfx.whoosh();
    launchSetupOpen.value = true;
  } else startLaunch();
}
