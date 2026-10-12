// One global tooltip for every element with a `data-tip` attribute.
// Desktop: hover. Touch: long-press (450 ms).

export function installTooltips() {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  document.body.appendChild(tip);
  let current: HTMLElement | null = null;
  let pressTimer: number | undefined;

  const show = (el: HTMLElement) => {
    const text = el.dataset.tip;
    if (!text) return;
    current = el;
    tip.textContent = text;
    tip.classList.add('show');
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.bottom + 8;
    if (y + th > window.innerHeight - 8) y = r.top - th - 8;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };
  const hide = () => {
    current = null;
    tip.classList.remove('show');
  };
  const find = (e: Event) => (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;

  document.addEventListener('pointerover', (e) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    const el = find(e);
    if (el && el !== current) show(el);
    else if (!el && current) hide();
  });
  document.addEventListener('pointerdown', (e) => {
    hide();
    const el = find(e);
    if (!el || (e as PointerEvent).pointerType !== 'touch') return;
    pressTimer = window.setTimeout(() => show(el), 450);
  });
  const cancel = () => clearTimeout(pressTimer);
  document.addEventListener('pointerup', cancel);
  document.addEventListener('pointercancel', cancel);
  document.addEventListener('scroll', hide, true);
}
