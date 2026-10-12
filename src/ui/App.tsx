import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { Editor } from './editor/Editor';
import { game, launchData, launchSetupOpen, mode, settingsOpen, toVisual, useGameState } from './game';
import { Hud } from './hud/Hud';
import { ActionBar, BenchLabel, FounderBark, Goals, Products, Toasts } from './hud/Panels';
import { Settings } from './hud/Settings';
import { lang } from './i18n';
import { LaunchSequence } from './launch/LaunchSequence';
import { LaunchSetup } from './launch/LaunchSetup';
import { Drawer, DrawerTabs } from './panels/Drawer';
import { WelcomeBack } from './hud/WelcomeBack';
import { DailyModal, useDailySync } from './hud/Daily';
import { EventCard, NewsTicker } from './hud/World';
import { TeamLabels, ViewToggle } from './hud/Office';
import { isWorking } from '../sim/team';
import { lineScrapRate, stockTotal } from '../sim/factory';
import { TEMPOS, warehouseCapacity } from '../data/factory';
import { colorById } from '../data/design';

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
    engine.setPhase(state.phase, state.company.name);
    engine.setOffice({
      level: state.team.office,
      lab: state.team.lab,
      studio: state.team.studio,
      companyName: state.company.name,
      staff: state.team.staff.map((e) => ({ id: e.id, role: e.role, look: e.look, morale: e.morale, away: !isWorking(e, state.day) })),
      busy: !!state.dev && !state.dev.done,
    });
    engine.setStore({
      stores: Object.values(state.regions.stores).reduce((a, b) => a + b, 0),
      companyName: state.company.name,
      phones: [...state.products].reverse().filter((p) => p.active).map((p) => colorById(p.design.colorId)?.hex ?? '#cccccc'),
    });
    const records = [...state.hall, ...state.legacy.hall.filter((h) => !state.hall.some((x) => x.kind === h.kind))];
    // Record phones first, then the all-time best sellers fill the remaining cases.
    const fame = records.filter((h) => h.color !== undefined).map((h) => h.color ?? null);
    const sellers = [...state.products].sort((a, b) => b.unitsSold - a.unitsSold).map((p) => colorById(p.design.colorId)?.hex ?? null);
    engine.setHall({ companyName: state.company.name, colors: [...fame, ...sellers].slice(0, 6) });
    const f = state.factory;
    engine.setFactory({
      size: f.size,
      speed: TEMPOS[f.tempo].speed,
      warehouse: f.warehouse,
      fill: stockTotal(state) / warehouseCapacity(f.warehouse),
      lines: f.lines.map((line) => {
        const p = state.products.find((x) => x.id === line.productId && x.active && !x.madeToOrder);
        return {
          level: line.level,
          colorHex: p ? colorById(p.design.colorId)?.hex ?? '#d8d8d8' : null,
          running: !line.paused && line.lastWeek + line.week > 0,
          scrap: lineScrapRate(state, line),
        };
      }),
    });
  });
}

export function App() {
  usePhoneSync();
  useDailySync();
  void lang.value; // re-render on language change
  const m = mode.value;
  return (
    <div class="ui-layer">
      <Hud />
      {m === 'free' && <Goals />}
      {m === 'free' && <Products />}
      {m === 'free' && <ActionBar />}
      {m === 'free' && <BenchLabel />}
      {m === 'free' && <TeamLabels />}
      {m === 'free' && <ViewToggle />}
      {m === 'free' && <NewsTicker />}
      {m === 'free' && <DrawerTabs />}
      {m === 'free' && <Drawer />}
      <FounderBark />
      {(m === 'tutorial' || m === 'editor') && <Editor />}
      {launchData.value && <LaunchSequence />}
      <Toasts />
      {launchSetupOpen.value && <LaunchSetup />}
      <WelcomeBack />
      <DailyModal />
      <EventCard />
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
