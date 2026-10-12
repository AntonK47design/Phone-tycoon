// Minimal observable store around the game rules.

import type { SimEvent } from './events';
import { advanceDay, applyAction, type Action } from './game';
import type { GameState } from './state';

export interface Store {
  getState(): GameState;
  /** Replaces the whole state (load / reset). */
  replace(state: GameState): void;
  dispatch(action: Action): SimEvent[];
  tick(days?: number): SimEvent[];
  subscribe(fn: () => void): () => void;
  onEvents(fn: (events: SimEvent[]) => void): () => void;
  /** Increments on every change. */
  revision(): number;
}

export function createStore(initial: GameState): Store {
  let state = initial;
  let rev = 0;
  const subs = new Set<() => void>();
  const eventSubs = new Set<(e: SimEvent[]) => void>();

  const emit = (events: SimEvent[]) => {
    rev++;
    subs.forEach((fn) => fn());
    if (events.length) eventSubs.forEach((fn) => fn(events));
  };

  return {
    getState: () => state,
    replace(next) {
      state = next;
      emit([]);
    },
    dispatch(action) {
      const events = applyAction(state, action);
      emit(events);
      return events;
    },
    tick(days = 1) {
      let events: SimEvent[] = [];
      for (let i = 0; i < days; i++) events = events.concat(advanceDay(state));
      emit(events);
      return events;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    onEvents(fn) {
      eventSubs.add(fn);
      return () => eventSubs.delete(fn);
    },
    revision: () => rev,
  };
}
