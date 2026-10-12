import { sfx } from '../../audio/sfx';
import { isFirstLaunch } from '../../sim/game';
import { mark } from '../funnel';
import { game, launchData, mode } from '../game';

/** Starts the launch sequence. The sim action is dispatched by the sequence itself. */
export function startLaunch() {
  if (launchData.value) return;
  const { store } = game();
  const st = store.getState();
  if (!isFirstLaunch(st) && !st.dev?.done) return;
  sfx.unlock();
  sfx.whoosh();
  mark('launch');
  mode.value = 'launch';
  launchData.value = { firstLaunch: isFirstLaunch(st), events: [] };
}
