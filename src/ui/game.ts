// UI-side context: store, engine, platform plus transient UI signals.

import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { Engine } from '../render/engine';
import type { PhoneVisual } from '../render/phone/PhoneModel';
import type { Platform } from '../platform/platform';
import { colorById } from '../data/design';
import type { ToastIcon } from './icons';
import type { SimEvent } from '../sim/events';
import type { PhoneDesign } from '../sim/state';
import type { Store } from '../sim/store';
import type { Speed } from '../sim/time';

export interface GameContext {
  store: Store;
  engine: Engine;
  platform: Platform;
  /** Idempotent gameplayStart/Stop wrapper. */
  gameplay: { start(): void; stop(): void };
  save(): void;
  reset(): void;
}

let ctx: GameContext | null = null;
export function setGame(c: GameContext) {
  ctx = c;
}
export function game(): GameContext {
  if (!ctx) throw new Error('game not initialised');
  return ctx;
}

export type Mode = 'intro' | 'tutorial' | 'free' | 'editor' | 'launch';

export const mode = signal<Mode>('intro');
export const speed = signal<Speed>(1);
/** Fraction of the current game day (0–1) for progress bars / clock. */
export const dayFraction = signal(0);
export const settingsOpen = signal(false);
/** While set, the HUD cash counter shows this value instead of the real cash. */
export const cashOverride = signal<number | null>(null);

export interface LaunchData {
  firstLaunch: boolean;
  events: SimEvent[];
}
export const launchData = signal<LaunchData | null>(null);

/** Founder thought bubble shown above the workbench. */
export const bark = signal<{ id: number; text: string } | null>(null);
let barkId = 1;
let lastBark = '';
export function sayBark(lines: string[]) {
  const options = lines.filter((l) => l !== lastBark);
  if (!options.length) return;
  const text = options[Math.floor(Math.random() * options.length)];
  lastBark = text;
  const b = { id: barkId++, text };
  bark.value = b;
  setTimeout(() => {
    if (bark.value?.id === b.id) bark.value = null;
  }, 4700);
}

export interface Toast {
  id: number;
  text: string;
  icon?: ToastIcon;
  gold?: boolean;
}
export const toasts = signal<Toast[]>([]);
let toastId = 1;
export function toast(text: string, icon?: ToastIcon, gold?: boolean) {
  const t = { id: toastId++, text, icon, gold };
  toasts.value = [...toasts.value.slice(-3), t];
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== t.id)), 4000);
}

/** Re-render on every store change. Returns the current state. */
export function useGameState() {
  const { store } = game();
  const [, setRev] = useState(0);
  useEffect(() => store.subscribe(() => setRev(store.revision())), [store]);
  return store.getState();
}

export function toVisual(d: PhoneDesign): PhoneVisual {
  return {
    colorHex: d.colorId ? colorById(d.colorId)?.hex ?? null : null,
    shapeId: d.shapeId,
    displaySize: d.displaySize,
    kitYear: 2007,
    finishId: d.finishId,
    lenses: 1,
  };
}
