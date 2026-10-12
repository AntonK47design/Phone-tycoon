import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { calendar, type Speed } from '../../sim/time';
import { decimal, money, moneyFull, shortNum } from '../format';
import { cashOverride, dayFraction, game, mode, settingsOpen, speed, useGameState } from '../game';
import { lang, t } from '../i18n';

/** Smoothly rolls a displayed number towards `target`. */
export function useRolling(target: number, tau = 0.35): number {
  const [shown, setShown] = useState(target);
  const ref = useRef({ value: target, raf: 0, last: 0 });
  useEffect(() => {
    const st = ref.current;
    cancelAnimationFrame(st.raf);
    st.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - st.last) / 1000);
      st.last = now;
      const diff = target - st.value;
      if (Math.abs(diff) < 0.5) {
        st.value = target;
        setShown(target);
        return;
      }
      st.value += diff * (1 - Math.exp(-dt / tau));
      setShown(st.value);
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(st.raf);
  }, [target, tau]);
  return shown;
}

const PauseIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
);
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);

export function Hud() {
  const state = useGameState();
  const { store } = game();
  const [editing, setEditing] = useState(false);
  const cash = useRolling(cashOverride.value ?? state.company.cash);
  const l = lang.value;
  const cal = calendar(state.day);
  const speeds: Speed[] = [0, 1, 2, 4];
  if (mode.value === 'intro') return null;

  const setSpeed = (s: Speed) => {
    sfx.click();
    speed.value = s;
  };
  const commitName = (v: string) => {
    store.dispatch({ type: 'renameCompany', name: v });
    setEditing(false);
  };

  return (
    <div class="hud">
      <div class="glass hud-company">
        <div class="hud-logo">{state.company.name.charAt(0).toUpperCase()}</div>
        {editing ? (
          <input
            class="hud-name-input"
            maxLength={28}
            value={state.company.name}
            ref={(el) => el?.focus()}
            onKeyDown={(e) => e.key === 'Enter' && commitName((e.target as HTMLInputElement).value)}
            onBlur={(e) => commitName((e.target as HTMLInputElement).value)}
          />
        ) : (
          <button class="hud-name" data-tip={t('hud.rename')} onClick={() => setEditing(true)}>
            {state.company.name}
          </button>
        )}
      </div>

      {state.clockStarted && (
        <div class="glass hud-center">
          <div data-tip={t('tip.date')}>
            <div class="hud-date">{t('hud.date', { week: cal.week, year: cal.year })}</div>
            <div class="day-progress"><i style={{ width: `${((cal.weekday + dayFraction.value) / 7) * 100}%` }} /></div>
          </div>
          <div class="speed" data-tip={t('tip.speed')}>
            {speeds.map((s) => (
              <button key={s} class={speed.value === s ? 'on' : ''} onClick={() => setSpeed(s)} aria-label={s === 0 ? t('hud.pause') : `${s}x`}>
                {s === 0 ? <PauseIcon /> : `${s}×`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="hud-right" style={state.clockStarted ? undefined : { marginLeft: 'auto' }}>
        <div class="glass stat-chip brand" data-tip={t('tip.brand')}>
          <span class="label">{t('hud.brand')}</span>
          <span class="val">{decimal(state.company.brand, l, 0)}</span>
        </div>
        <div class="glass stat-chip fans" data-tip={t('tip.fans')}>
          <span class="label">{t('hud.fans')}</span>
          <span class="val">{shortNum(state.company.fans, l)}</span>
        </div>
        <div class="glass stat-chip cash" data-tip={`${t('tip.cash')} (${moneyFull(state.company.cash, l)})`}>
          <span class="val">{money(cash, l)}</span>
        </div>
        <button class="glass icon-btn" aria-label={t('hud.settings')} onClick={() => ((settingsOpen.value = true), sfx.click())}>
          <GearIcon />
        </button>
      </div>
    </div>
  );
}
