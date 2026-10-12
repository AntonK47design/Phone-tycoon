import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { Editor } from './editor/Editor';
import { game, launchData, mode, settingsOpen, toVisual, useGameState } from './game';
import { Hud } from './hud/Hud';
import { ActionBar, BenchLabel, FounderBark, Goals, Products, Toasts } from './hud/Panels';
import { Settings } from './hud/Settings';
import { lang } from './i18n';
import { LaunchSequence } from './launch/LaunchSequence';

const DevPanel = import.meta.env.DEV ? lazy(() => import('./debug/DevPanel').then((m) => ({ default: m.DevPanel }))) : null;

/** Keeps the turntable phone in sync with what the player should see. */
function usePhoneSync() {
  const state = useGameState();
  const { engine } = game();
  const m = mode.value;
  useEffect(() => {
    if (m === 'launch') return;
    const last = state.products[state.products.length - 1];
    const design = m === 'editor' || m === 'tutorial' ? state.draft : state.dev?.design ?? last?.design ?? state.draft;
    engine.setPhone(toVisual(design));
  });
}

export function App() {
  usePhoneSync();
  void lang.value; // re-render on language change
  const m = mode.value;
  return (
    <div class="ui-layer">
      <Hud />
      {m === 'free' && <Goals />}
      {m === 'free' && <Products />}
      {m === 'free' && <ActionBar />}
      {m === 'free' && <BenchLabel />}
      <FounderBark />
      {(m === 'tutorial' || m === 'editor') && <Editor />}
      {launchData.value && <LaunchSequence />}
      <Toasts />
      {settingsOpen.value && <Settings />}
      <div id="fx-layer" class="passthrough" />
      {DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
    </div>
  );
}
