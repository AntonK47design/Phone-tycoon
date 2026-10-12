// Office view: room toggle and floating team labels with live progress.

import { useEffect, useRef } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { ROLE_COLORS, ROLES, type Role } from '../../data/team';
import { researchProgress } from '../../sim/research';
import type { GameState } from '../../sim/state';
import { marketingBoost } from '../../sim/team';
import { drawer, game, hubView, useGameState, type Room } from '../game';
import { t } from '../i18n';

export function ViewToggle() {
  const state = useGameState();
  const { engine } = game();
  if (state.phase < 2) return null;
  const rooms: Room[] = state.factory.size > 0 ? ['garage', 'office', 'factory'] : ['garage', 'office'];
  const go = (v: Room) => {
    if (hubView.value === v) return;
    sfx.whoosh();
    hubView.value = v;
    engine.goToView(v === 'garage' ? 'overview' : v, 1.3);
    if (v !== 'office' && drawer.value === 'team') drawer.value = null;
    if (v !== 'factory' && drawer.value === 'factory') drawer.value = null;
  };
  return (
    <div class="view-toggle">
      {rooms.map((r) => (
        <button key={r} class={hubView.value === r ? 'on' : ''} onClick={() => go(r)}>
          {t(`office.view.${r}`)}
          {r === 'office' && state.team.staff.length === 0 && <i class="dot-alert" />}
        </button>
      ))}
    </div>
  );
}

function roleProgress(state: GameState, role: Role): { pct: number | null; text: string } {
  const dev = state.dev && !state.dev.done ? state.dev : null;
  const key = role === 'designer' ? 'design' : role === 'engineer' ? 'tech' : role === 'programmer' ? 'software' : null;
  if (key) {
    if (!dev) return { pct: null, text: t('office.idle') };
    return { pct: Math.min(1, dev.progress[key] / Math.max(1, dev.required[key])), text: dev.design.name };
  }
  if (role === 'researcher') {
    const r = researchProgress(state);
    return r ? { pct: r.progress / r.need, text: t('office.researching') } : { pct: null, text: t('office.idle') };
  }
  return { pct: null, text: t('office.hypeBoost', { pct: Math.round((marketingBoost(state) - 1) * 100) }) };
}

/** One label per team, floating above its desks. */
export function TeamLabels() {
  const state = useGameState();
  const refs = useRef<Partial<Record<Role, HTMLDivElement | null>>>({});
  const { engine } = game();
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      for (const role of ROLES) {
        const el = refs.current[role];
        if (!el) continue;
        const p = engine.project(`team:${role}`);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        el.style.opacity = p.visible ? '1' : '0';
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [engine]);
  if (hubView.value !== 'office' || state.phase < 2) return null;
  const present = ROLES.filter((r) => state.team.staff.some((e) => e.role === r));
  return (
    <>
      {present.map((role) => {
        const n = state.team.staff.filter((e) => e.role === role).length;
        const pr = roleProgress(state, role);
        return (
          <div key={role} class="glass world-label team-label passthrough" ref={(el) => {
              refs.current[role] = el;
            }}>
            <span class="team-name" style={{ color: ROLE_COLORS[role] }}>{t(`team.roles.${role}`)} ×{n}</span>
            <span class="team-what">{pr.text}</span>
            {pr.pct !== null && (
              <div class="bar light"><i style={{ width: `${pr.pct * 100}%`, background: ROLE_COLORS[role] }} /></div>
            )}
          </div>
        );
      })}
    </>
  );
}
