// Guided tour of the side panels (Company, Team, Research, Market). Starts once when the
// tabs first appear (office rented) and can be replayed with the "?" tab.

import { useEffect } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import type { GameState } from '../../sim/state';
import { dailyOpen, drawer, game, launchData, launchSetupOpen, settingsOpen, tourStep, useGameState, welcomeReport, type DrawerTab } from '../game';
import { t } from '../i18n';
import { openTab } from '../panels/Drawer';

export const TOUR_ID = 'panels';

interface TourStep {
  tab: DrawerTab;
  /** Optional hands-on task; ticked off as soon as it's done. */
  task?: (state: GameState) => boolean;
}

export const TOUR_STEPS: TourStep[] = [
  { tab: 'company' },
  { tab: 'team', task: (s) => s.team.staff.length > 0 },
  { tab: 'research', task: (s) => !!s.research.current || s.research.done.length > 0 },
  { tab: 'market' },
];

const LINES = 3;

function blocked(state: GameState): boolean {
  return dailyOpen.value || settingsOpen.value || !!launchData.value || launchSetupOpen.value || !!welcomeReport.value || !!state.events.pending;
}

export function Tour() {
  const state = useGameState();
  const step = tourStep.value;

  // First visit with the panels: start the tour once nothing else is on screen.
  const auto = step === null && state.phase >= 2 && !(state.tours ?? []).includes(TOUR_ID) && !blocked(state);
  useEffect(() => {
    if (auto) tourStep.value = 0;
  }, [auto]);

  // Each step opens its panel.
  useEffect(() => {
    if (step !== null && TOUR_STEPS[step]) openTab(TOUR_STEPS[step].tab);
  }, [step]);

  if (step === null || !TOUR_STEPS[step] || blocked(state)) return null;
  const def = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  const finish = () => {
    game().store.dispatch({ type: 'tourDone', id: TOUR_ID });
    tourStep.value = null;
    drawer.value = null;
  };
  const go = (n: number) => {
    sfx.click();
    tourStep.value = n;
  };
  const done = def.task?.(state) ?? false;

  return (
    <div class="tour paper" role="dialog" aria-live="polite" key={step}>
      <div class="tour-head">
        <span class="tour-count">{t('tour.count', { n: step + 1, total: TOUR_STEPS.length })}</span>
        <button class="tour-skip" onClick={finish}>
          {t('tour.skip')}
        </button>
      </div>
      <h4 class="tour-title">{t(`tour.${def.tab}.title`)}</h4>
      <ul class="tour-lines">
        {Array.from({ length: LINES }, (_, i) => (
          <li key={i}>{t(`tour.${def.tab}.l${i + 1}`)}</li>
        ))}
      </ul>
      {def.task && (
        <div class={`tour-task ${done ? 'done' : ''}`}>
          <i>{done ? '✓' : '○'}</i> {t(`tour.${def.tab}.task`)}
        </div>
      )}
      <div class="tour-nav">
        {step > 0 && (
          <button class="btn-secondary" onClick={() => go(step - 1)}>
            {t('tour.back')}
          </button>
        )}
        <button class={`btn-primary ${done || !def.task ? '' : 'quiet'}`} onClick={() => (last ? (sfx.click(), finish()) : go(step + 1))}>
          {last ? t('tour.done') : t('tour.next')}
        </button>
      </div>
    </div>
  );
}
