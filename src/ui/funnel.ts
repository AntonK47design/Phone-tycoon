// First-minute funnel timer (GDD §19). Times are ms since navigation start.

export type FunnelMark = 'firstFrame' | 'firstInput' | 'launch' | 'reward';

export const funnel: Partial<Record<FunnelMark, number>> = {};

export function mark(name: FunnelMark) {
  if (funnel[name] === undefined) {
    funnel[name] = performance.now();
    if (import.meta.env.DEV) console.info(`[funnel] ${name}: ${(funnel[name]! / 1000).toFixed(1)}s`);
  }
}

if (typeof window !== 'undefined') {
  const first = () => {
    mark('firstInput');
    window.removeEventListener('pointerdown', first);
  };
  window.addEventListener('pointerdown', first);
}
