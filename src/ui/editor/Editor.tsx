import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { COLORS, DISPLAY_SIZES, SHAPES } from '../../data/design';
import { forecast, isFirstLaunch, type Forecast } from '../../sim/game';
import { isTrendColor } from '../../sim/scoring/score';
import type { PhoneDesign, TutorialStep } from '../../sim/state';
import { yearOf } from '../../sim/time';
import { decimal, money, shortNum } from '../format';
import { mark } from '../funnel';
import { game, mode, toVisual, useGameState } from '../game';
import { lang, t } from '../i18n';
import { startLaunch } from '../launch/flow';

const STEPS: TutorialStep[] = ['color', 'shape', 'display', 'launch'];
type Category = 'color' | 'shape' | 'display';

function ShapeIcon({ id }: { id: string }) {
  const s = SHAPES.find((x) => x.id === id)!;
  const w = id === 'slim' ? 20 : 22;
  const r = s.corner * 0.5;
  return (
    <svg viewBox="0 0 26 40">
      <rect x={(26 - w) / 2} y="2" width={w} height="36" rx={r} fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.85)" stroke-width="1.6" />
      <rect x={(26 - w) / 2 + 2.5} y="7" width={w - 5} height="25" rx="1.2" fill="rgba(120,180,255,.6)" />
    </svg>
  );
}

function DisplayIcon({ size }: { size: number }) {
  const k = size / 4;
  const w = 20 * k;
  const h = 34 * k;
  return (
    <svg viewBox="0 0 26 40">
      <rect x={(26 - w) / 2} y={(40 - h) / 2} width={w} height={h} rx="3" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.7)" stroke-width="1.4" />
      <rect x={(26 - w) / 2 + 2} y={(40 - h) / 2 + 4} width={w - 4} height={h - 8} rx="1" fill="rgba(120,180,255,.75)" />
    </svg>
  );
}

interface Delta {
  key: number;
  value: number;
}

function useDelta(value: number, threshold = 0.05): Delta | null {
  const prev = useRef(value);
  const [delta, setDelta] = useState<Delta | null>(null);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (Math.abs(d) >= threshold) setDelta({ key: performance.now(), value: d });
  }, [value]);
  return delta;
}

function DeltaChip({ delta, invert, fmt }: { delta: Delta | null; invert?: boolean; fmt: (v: number) => string }) {
  if (!delta) return null;
  const up = invert ? delta.value < 0 : delta.value > 0;
  return (
    <span key={delta.key} class={`delta ${up ? 'up' : 'down'}`}>
      {delta.value > 0 ? '+' : '−'}
      {fmt(Math.abs(delta.value))}
    </span>
  );
}

function Stats({ fc, full, free }: { fc: Forecast; full: boolean; free: boolean }) {
  const l = lang.value;
  const dDesign = useDelta(fc.design);
  const dTech = useDelta(fc.tech);
  const dReview = useDelta(fc.review);
  const dCost = useDelta(fc.unitCost, 0.5);
  const reviewColor = fc.review >= 8 ? 'var(--good)' : fc.review >= 6.5 ? '#ffd666' : 'var(--bad)';
  return (
    <div class="glass editor-right">
      <div class="review-big" data-tip={t('tip.review')} style={{ position: 'relative' }}>
        <span class="lbl">{t('editor.review')}</span>
        <span class="num" style={{ color: reviewColor }}>
          {decimal(fc.review, l)}
          <small>/10</small>
        </span>
        <DeltaChip delta={dReview} fmt={(v) => decimal(v, l)} />
      </div>
      <div class="bar-row" data-tip={t('tip.design')}>
        <span>{t('editor.design')}</span>
        <div class="bar"><i style={{ width: `${fc.design * 10}%`, background: 'linear-gradient(90deg,#8a63ff,var(--design))' }} /></div>
        <b>{decimal(fc.design, l)}</b>
        <DeltaChip delta={dDesign} fmt={(v) => decimal(v, l)} />
      </div>
      <div class="bar-row" data-tip={t('tip.tech')}>
        <span>{t('editor.tech')}</span>
        <div class="bar"><i style={{ width: `${fc.tech * 10}%`, background: 'linear-gradient(90deg,#2a8cff,var(--tech))' }} /></div>
        <b>{decimal(fc.tech, l)}</b>
        <DeltaChip delta={dTech} fmt={(v) => decimal(v, l)} />
      </div>
      {full && (
        <>
          <div class="divider" />
          <div class="stat-row" data-tip={t('tip.unitCost')}>
            <span class="k">{t('editor.unitCost')}</span>
            <span class="v">{money(fc.unitCost, l)}</span>
            <DeltaChip delta={dCost} invert fmt={(v) => money(v, l)} />
          </div>
          <div class="stat-row" data-tip={t('tip.price')}>
            <span class="k">{t('editor.price')}</span>
            <span class="v">{money(fc.price, l)}</span>
          </div>
          <div class="stat-row" data-tip={t('tip.margin')}>
            <span class="k">{t('editor.margin')}</span>
            <span class="v" style={{ color: fc.margin > 0 ? 'var(--good)' : 'var(--bad)' }}>{money(fc.margin, l)}</span>
          </div>
          <div class="stat-row" data-tip={t('tip.weekly')}>
            <span class="k">{t('editor.weekly')}</span>
            <span class="v">{t('editor.weeklyValue', { n: shortNum(fc.weeklyUnits, l) })}</span>
          </div>
          {free && (
            <>
              <div class="stat-row" data-tip={t('tip.devTime')}>
                <span class="k">{t('editor.devTime')}</span>
                <span class="v">{t('editor.devTimeValue', { days: fc.devDays })}</span>
              </div>
              <div class="stat-row" data-tip={t('tip.devCost')}>
                <span class="k">{t('editor.devCost')}</span>
                <span class="v">{money(fc.devCost, l)}</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function Editor() {
  const state = useGameState();
  const { store, engine } = game();
  const l = lang.value;
  const tutorialMode = mode.value === 'tutorial';
  const step = state.tutorial;
  const stepIdx = tutorialMode && step !== 'done' ? STEPS.indexOf(step) : 3;
  const draft = state.draft;
  const fc = forecast(state);
  const year = yearOf(state.day);
  const first = isFirstLaunch(state);
  const [hint, setHint] = useState<{ x: number; y: number; side: 'left' | 'bottom' } | null>(null);
  const advanceTimer = useRef<number>();

  const select = (cat: Category, patch: Partial<PhoneDesign>) => {
    mark('firstInput');
    store.dispatch({ type: 'setDraft', patch });
    const next = { ...store.getState().draft };
    engine.setPhone(toVisual(next), { flourish: cat === 'shape' });
    if (cat === 'color') sfx.paint();
    else sfx.pop(cat === 'shape' ? 1 : 1.25);
    if (tutorialMode && step === cat) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => {
        store.dispatch({ type: 'setTutorial', step: STEPS[STEPS.indexOf(cat) + 1] });
      }, cat === 'color' ? 900 : 650);
    }
  };

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  // Position the tutorial hint next to the active category / launch button.
  useLayoutEffect(() => {
    if (!tutorialMode || step === 'done') {
      setHint(null);
      return;
    }
    const place = () => {
      if (step === 'launch') {
        const b = document.querySelector('.btn-launch')?.getBoundingClientRect();
        if (b) setHint({ x: b.left + b.width / 2, y: b.top - 14, side: 'bottom' });
      } else {
        const c = document.querySelector('.cat.active')?.getBoundingClientRect();
        const panel = document.querySelector('.editor-left')?.getBoundingClientRect();
        if (c && panel) setHint({ x: panel.right + 14, y: c.top + Math.min(c.height / 2, 46), side: 'left' });
      }
    };
    place();
    const id = window.setTimeout(place, 480);
    window.addEventListener('resize', place);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', place);
    };
  }, [step, tutorialMode]);

  const close = () => {
    sfx.click();
    mode.value = 'free';
    engine.goToView('overview', 1.1);
  };

  const startDev = () => {
    const ev = store.dispatch({ type: 'startDev' });
    if (ev.some((e) => e.type === 'devStarted')) {
      mode.value = 'free';
      engine.goToView('overview', 1.2);
    }
  };

  const skip = () => {
    sfx.click();
    clearTimeout(advanceTimer.current);
    // Never launch an unpainted prototype: pick this season's first trend color.
    if (!state.draft.colorId) {
      const trend = COLORS.find((c) => state.unlockedColors.includes(c.id) && isTrendColor(c.id, year));
      if (trend) {
        store.dispatch({ type: 'setDraft', patch: { colorId: trend.id } });
        engine.setPhone(toVisual(store.getState().draft));
      }
    }
    store.dispatch({ type: 'setTutorial', step: 'done' });
  };

  const catClass = (i: number) => `cat ${stepIdx === i && tutorialMode && step !== 'done' ? 'active' : ''} ${stepIdx > i && tutorialMode ? 'done' : ''}`;
  const colors = COLORS.filter((c) => state.unlockedColors.includes(c.id));
  const showLaunch = first && (step === 'launch' || step === 'done');

  return (
    <div class="ui-layer">
      <div class="glass editor-left">
        <div class="editor-title">
          <span>{draft.name}</span>
          {!tutorialMode && (
            <button class="icon-btn" aria-label={t('editor.close')} onClick={close} style={{ width: 36, height: 36 }}>
              ✕
            </button>
          )}
        </div>

        <div class={catClass(0)}>
          <h5><span class="num">1</span>{t('editor.cat.color')}</h5>
          <div class="swatches">
            {colors.map((c) => (
              <button
                key={c.id}
                class={`swatch ${draft.colorId === c.id ? 'sel' : ''}`}
                style={{ background: c.hex }}
                data-tip={t(`color.${c.id}`)}
                aria-label={t(`color.${c.id}`)}
                onClick={() => select('color', { colorId: c.id })}
              >
                {isTrendColor(c.id, year) && <span class="badge">{t('editor.trend')}</span>}
                {!c.starter && <span class="badge new">{t('editor.new')}</span>}
              </button>
            ))}
          </div>
        </div>

        {stepIdx >= 1 && (
          <div class={catClass(1)}>
            <h5><span class="num">2</span>{t('editor.cat.shape')}</h5>
            <div class="options">
              {SHAPES.map((s) => (
                <button key={s.id} class={`option ${draft.shapeId === s.id ? 'sel' : ''}`} onClick={() => select('shape', { shapeId: s.id })}>
                  <ShapeIcon id={s.id} />
                  {t(`editor.shape.${s.id}`)}
                  <span class="meta">{decimal(s.thickness, l)} mm{s.cost ? ` · +${money(s.cost, l)}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stepIdx >= 2 && (
          <div class={catClass(2)}>
            <h5><span class="num">3</span>{t('editor.cat.display')}</h5>
            <div class="options">
              {DISPLAY_SIZES.map((size) => (
                <button key={size} class={`option ${draft.displaySize === size ? 'sel' : ''}`} onClick={() => select('display', { displaySize: size })}>
                  <DisplayIcon size={size} />
                  {t('editor.inches', { n: decimal(size, l) })}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Stats fc={fc} full={!tutorialMode || stepIdx >= 3} free={!first} />

      <div class="editor-bottom">
        {showLaunch && (
          <button class="btn-primary btn-launch pulse" onClick={startLaunch}>
            🚀 {t('editor.launch')}
          </button>
        )}
        {!first && (
          <button class="btn-primary" disabled={state.company.cash < fc.devCost || !!state.dev} onClick={startDev}>
            🛠️ {t('editor.startDev')} · {money(fc.devCost, l)}
          </button>
        )}
      </div>

      {tutorialMode && step !== 'done' && (
        <button class="btn-secondary skip" onClick={skip}>
          {t('tutorial.skip')} ›
        </button>
      )}

      {hint && (
        <div
          class="hint-pos"
          style={
            hint.side === 'left'
              ? { left: `${hint.x}px`, top: `${hint.y}px`, transform: 'translateY(-50%)' }
              : { left: `${hint.x}px`, top: `${hint.y}px`, transform: 'translate(-50%, -100%)' }
          }
        >
          <div class={`hint ${hint.side}`} key={step}>
            {hint.side === 'left' && <span class="arrow-bob">👈</span>}
            {t(`tutorial.${step}`)}
          </div>
        </div>
      )}
    </div>
  );
}
