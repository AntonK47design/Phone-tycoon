// Real-time → game-day accumulator. The sim itself only knows whole days.

import { effect } from '@preact/signals';
import { SECONDS_PER_DAY } from '../sim/time';
import { dailyOpen, dayFraction, game, launchData, launchSetupOpen, mode, settingsOpen, speed, tourStep, welcomeReport } from './game';

let acc = 0;
let last = 0;
let adPaused = false;

export function setAdPaused(on: boolean) {
  adPaused = on;
}

export function isClockRunning(): boolean {
  const { store } = game();
  return (
    store.getState().clockStarted &&
    speed.value > 0 &&
    !settingsOpen.value &&
    !dailyOpen.value &&
    tourStep.value === null &&
    !store.getState().events.pending &&
    launchData.value === null &&
    !launchSetupOpen.value &&
    welcomeReport.value === null &&
    mode.value !== 'intro' &&
    !adPaused &&
    !document.hidden
  );
}

export function startClock() {
  const { store, engine } = game();
  last = performance.now();
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const running = isClockRunning();
    engine.clockRunning = running;
    if (!running) return;
    acc += (dt * speed.value) / SECONDS_PER_DAY;
    let days = Math.floor(acc);
    if (days > 0) {
      acc -= days;
      // Cap catch-up work per frame (e.g. after a hitch at x100).
      days = Math.min(days, 40);
      store.tick(days);
    }
    dayFraction.value = acc;
    engine.setDayFraction(acc);
  };
  requestAnimationFrame(loop);

  // Platform gameplay start/stop follows whether the player is actively playing.
  effect(() => {
    const paused = settingsOpen.value || speed.value === 0;
    const { gameplay } = game();
    if (mode.value === 'intro') return;
    if (paused) gameplay.stop();
    else gameplay.start();
  });
}
