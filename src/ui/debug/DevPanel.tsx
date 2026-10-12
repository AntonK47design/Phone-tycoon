// Dev-only debug panel (PLAN §8). Loaded via dynamic import only in DEV builds.

import { useEffect, useState } from 'preact/hooks';
import { funnel, type FunnelMark } from '../funnel';
import { game, speed } from '../game';
import type { Speed } from '../../sim/time';

const MARKS: FunnelMark[] = ['firstFrame', 'firstInput', 'launch', 'reward'];

export function DevPanel() {
  const { store, engine, reset } = game();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 500);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'F1' || e.key === '`') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', key);
    };
  }, []);
  const s = engine.stats();
  const reward = funnel.reward;
  const ok = reward !== undefined && reward < 60_000;
  const box: Record<string, string | number> = {
    position: 'absolute', right: '10px', bottom: '80px', zIndex: 300, font: '11px/1.4 ui-monospace, monospace',
    background: 'rgba(0,0,0,.78)', color: '#cfe', padding: '8px 10px', borderRadius: '10px', minWidth: '190px',
  };
  const btn = { background: '#334', color: '#fff', borderRadius: '6px', padding: '3px 7px', margin: '2px', fontSize: '11px' };
  return (
    <div style={box}>
      <div style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => setOpen(!open)}>
        DEV {s.fps.toFixed(0)} fps · {s.drawCalls} dc · {s.quality} {open ? '▾' : '▸'}
      </div>
      <div>
        funnel:{' '}
        {MARKS.map((m) => (
          <span key={m} style={{ marginRight: 6 }}>
            {m.replace('first', '')}={funnel[m] !== undefined ? (funnel[m]! / 1000).toFixed(1) : '–'}
          </span>
        ))}
        <span style={{ color: reward === undefined ? '#aaa' : ok ? '#5f5' : '#f55' }}>{reward === undefined ? '' : ok ? '✓<60s' : '✗>60s'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          <div>tris {s.triangles.toLocaleString()}</div>
          <button style={btn} onClick={() => store.dispatch({ type: 'debugCash', amount: 10_000 })}>+$10K</button>
          <button style={btn} onClick={() => store.dispatch({ type: 'debugCash', amount: 1_000_000 })}>+$1M</button>
          {([0, 1, 4, 100] as Speed[]).map((x) => (
            <button key={x} style={btn} onClick={() => (speed.value = x)}>x{x}</button>
          ))}
          <button style={btn} onClick={() => store.tick(364)}>+1 year</button>
          {(['low', 'medium', 'high', 'auto'] as const).map((q) => (
            <button key={q} style={btn} onClick={() => engine.setQuality(q)}>{q}</button>
          ))}
          <button style={{ ...btn, background: '#622' }} onClick={() => reset()}>reset save</button>
        </div>
      )}
    </div>
  );
}
