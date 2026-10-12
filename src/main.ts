// Bootstrap: platform → save → simulation → renderer → UI.

import { effect } from '@preact/signals';
import { render, h } from 'preact';
import { sfx } from './audio/sfx';
import { createPlatform } from './platform/crazygames';
import { trackGameplay } from './platform/platform';
import { Engine } from './render/engine';
import { newGame } from './sim/game';
import { createStore } from './sim/store';
import { App } from './ui/App';
import { startClock } from './ui/clock';
import { mark } from './ui/funnel';
import { game, mode, setGame, settingsOpen, storeRev, toVisual, welcomeReport } from './ui/game';
import { applyOffline } from './sim/offline';
import { setLang, lang } from './ui/i18n';
import { installJuice } from './ui/juice';
import { installAutosave, loadSave, SAVE_KEY, writeSave } from './ui/persistence';
import { loadPrefs } from './ui/hud/Settings';
import { installTooltips } from './ui/tooltip';
import '@fontsource/bungee/latin-400.css';
import '@fontsource/barlow-semi-condensed/latin-600.css';
import '@fontsource/barlow-semi-condensed/latin-800.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './ui/styles/main.css';

async function boot() {
  const platformPromise = createPlatform();
  setLang(lang.value, false);
  const engine = new Engine(document.getElementById('app')!);
  const prefs = loadPrefs();
  if (prefs.quality !== 'auto') engine.setQuality(prefs.quality);
  sfx.setEnabled(prefs.sound);

  const platform = await platformPromise;
  platform.loadingStart();
  const gameplay = trackGameplay(platform);

  const saved = loadSave(platform);
  const state = saved?.state ?? newGame((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  // Offline progress (GDD §20.1) before anything renders.
  const offline = saved ? applyOffline(state, Math.max(0, (Date.now() - saved.savedAt) / 1000)) : null;
  const store = createStore(state);
  const save = () => writeSave(platform, store.getState());
  setGame({
    store,
    engine,
    platform,
    gameplay,
    save,
    reset() {
      platform.data.remove(SAVE_KEY);
      window.removeEventListener('pagehide', save);
      location.reload();
    },
    startOver(next) {
      // Prestige: the new company replaces the save, then a fresh boot runs the tutorial.
      writeSave(platform, next);
      window.removeEventListener('pagehide', save);
      location.reload();
    },
  });

  store.subscribe(() => (storeRev.value = store.revision()));
  installTooltips();
  installJuice();
  render(h(App, {}), document.getElementById('ui')!);

  const st = store.getState();
  const inTutorial = st.stats.launches === 0;
  const last = st.products[st.products.length - 1];
  engine.setPhone(toVisual(inTutorial ? st.draft : st.dev?.design ?? last?.design ?? st.draft));

  engine.start(() => {
    mark('firstFrame');
    const loader = document.getElementById('loader');
    loader?.classList.add('hide');
    setTimeout(() => loader?.remove(), 700);
    platform.loadingStop();
    // Intro camera move: straight to the turntable for new players.
    engine.goToView(inTutorial ? 'editor' : 'overview', 2.4, () => {
      mode.value = inTutorial ? 'tutorial' : 'free';
      if (offline && (offline.cashDelta !== 0 || offline.researchDone.length || offline.devDone)) welcomeReport.value = offline;
      gameplay.start();
    });
  });

  startClock();
  installAutosave(save);

  // Audio needs a user gesture.
  const unlockAudio = () => sfx.unlock();
  window.addEventListener('pointerdown', unlockAudio, { once: false, passive: true });
  window.addEventListener('keydown', unlockAudio);

  // Stop rendering when hidden or behind a modal.
  const updatePause = () => engine.setPaused(document.hidden);
  document.addEventListener('visibilitychange', updatePause);
  effect(() => {
    if (settingsOpen.value) gameplay.stop();
  });

  if (import.meta.env.DEV) (window as unknown as { game: typeof game }).game = game;
}

boot().catch((e) => {
  console.error(e);
  const loader = document.getElementById('loader');
  if (loader) loader.innerHTML = '<div class="logo">Phone Empire 3D</div><p style="opacity:.7">WebGL is required to play.</p>';
});
