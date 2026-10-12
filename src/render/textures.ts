// Procedural canvas textures – no image downloads.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, repeat = false, anisotropy = 4): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Deterministic noise so textures look identical every load. */
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function concreteTexture(): Texture {
  const [c, ctx] = canvas(512, 512);
  const rnd = prng(7);
  ctx.fillStyle = '#9a958c';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.floor(rnd() * 40) - 20;
    ctx.fillStyle = `rgba(${128 + v},${124 + v},${116 + v},${0.08 + rnd() * 0.12})`;
    const s = 1 + rnd() * 3;
    ctx.fillRect(rnd() * 512, rnd() * 512, s, s);
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const r = 30 + rnd() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(70,64,58,${0.05 + rnd() * 0.08})`);
    g.addColorStop(1, 'rgba(70,64,58,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Expansion joints.
  ctx.strokeStyle = 'rgba(60,56,52,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(512, 1);
  ctx.moveTo(1, 0);
  ctx.lineTo(1, 512);
  ctx.stroke();
  const t = tex(c, true, 8);
  t.repeat.set(2.4, 2);
  return t;
}

export function woodTexture(base = '#b9844f'): Texture {
  const [c, ctx] = canvas(256, 512);
  const rnd = prng(3);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 256;
    ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '90,52,25' : '230,180,120'},${0.08 + rnd() * 0.12})`;
    ctx.lineWidth = 1 + rnd() * 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + i) * 4, y);
    ctx.stroke();
  }
  // Plank seams.
  ctx.fillStyle = 'rgba(60,35,18,0.35)';
  for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 2, 512);
  return tex(c, true);
}

export function pegboardTexture(): Texture {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#c99f68';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(60,40,20,0.75)';
  for (let y = 8; y < 256; y += 16) for (let x = 8; x < 256; x += 16) {
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = tex(c, true);
  t.repeat.set(3, 1.2);
  return t;
}

export function backgroundTexture(): Texture {
  const [c, ctx] = canvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#2b3160');
  g.addColorStop(0.55, '#1a1d3b');
  g.addColorStop(1, '#0c0e1d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  return tex(c);
}

export function skyTexture(): Texture {
  const [c, ctx] = canvas(64, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7fb2ff');
  g.addColorStop(0.6, '#ffd1a1');
  g.addColorStop(1, '#ffb27a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  // Distant skyline silhouettes.
  ctx.fillStyle = 'rgba(120,110,150,0.55)';
  const rnd = prng(11);
  for (let x = 0; x < 64; x += 6) {
    const h = 30 + rnd() * 60;
    ctx.fillRect(x, 256 - h, 5, h);
  }
  return tex(c);
}

function hsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

const ICON_COLORS = ['#ff6b6b', '#ffb84d', '#ffe066', '#6bd66b', '#4dc3ff', '#7a7aff', '#d36bff', '#ff7ab8', '#4de0c8', '#ff9966', '#9ad14d', '#5b8cff'];

/** Home screen for the phone display. `accent` follows the phone color. */
export function drawPhoneScreen(target: HTMLCanvasElement, accent: string | null, notch: 'none' | 'notch' | 'punch' = 'none') {
  const w = target.width;
  const h = target.height;
  const ctx = target.getContext('2d')!;
  const [hue] = hsl(accent ?? '#4466aa');
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, `hsl(${(hue + 200) % 360}, 70%, 58%)`);
  bg.addColorStop(0.5, `hsl(${(hue + 250) % 360}, 60%, 38%)`);
  bg.addColorStop(1, `hsl(${(hue + 290) % 360}, 55%, 20%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const blob = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  blob(w * 0.8, h * 0.18, w * 0.7, `hsla(${(hue + 160) % 360}, 90%, 70%, 0.55)`);
  blob(w * 0.1, h * 0.75, w * 0.8, `hsla(${(hue + 320) % 360}, 90%, 60%, 0.4)`);

  const u = w / 100;
  // Status bar.
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `600 ${5 * u}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('10:07', 6 * u, 6 * u);
  for (let i = 0; i < 4; i++) ctx.fillRect(w - 26 * u + i * 3 * u, 8 * u - (i + 1) * 1.1 * u, 2 * u, (i + 1) * 1.1 * u);
  roundRect(ctx, w - 12 * u, 4.2 * u, 8 * u, 3.6 * u, 0.8 * u);
  ctx.fill();

  // Clock widget.
  ctx.font = `200 ${22 * u}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('10:07', w / 2, 30 * u);
  ctx.font = `500 ${4.4 * u}px system-ui, sans-serif`;
  ctx.globalAlpha = 0.8;
  ctx.fillText('MON 14', w / 2, 44 * u);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // App grid.
  const cols = 4;
  const size = 16 * u;
  const gap = (w - cols * size) / (cols + 1);
  const rows = Math.min(5, Math.floor((h - 88 * u) / (size + gap)));
  let ci = Math.floor(hue / 30);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = gap + col * (size + gap);
      const y = 54 * u + r * (size + gap * 1.1);
      const color = ICON_COLORS[ci++ % ICON_COLORS.length];
      const g = ctx.createLinearGradient(x, y, x, y + size);
      g.addColorStop(0, color);
      g.addColorStop(1, `${color}aa`);
      ctx.fillStyle = g;
      roundRect(ctx, x, y, size, size, size * 0.26);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const kind = (r * cols + col) % 3;
      if (kind === 0) {
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 1) {
        roundRect(ctx, x + size * 0.28, y + size * 0.28, size * 0.44, size * 0.44, size * 0.08);
        ctx.fill();
      } else {
        ctx.fillRect(x + size * 0.25, y + size * 0.45, size * 0.5, size * 0.1);
        ctx.fillRect(x + size * 0.45, y + size * 0.25, size * 0.1, size * 0.5);
      }
    }
  }

  // Dock.
  const dockY = h - 24 * u;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(ctx, 4 * u, dockY, w - 8 * u, 20 * u, 6 * u);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const x = gap + i * (size + gap);
    ctx.fillStyle = ICON_COLORS[(i * 3 + 1) % ICON_COLORS.length];
    roundRect(ctx, x, dockY + 2 * u, size, size, size * 0.26);
    ctx.fill();
  }

  if (notch !== 'none') {
    ctx.fillStyle = '#000';
    if (notch === 'notch') {
      roundRect(ctx, w * 0.3, -4 * u, w * 0.4, 10 * u, 3 * u);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(w / 2, 5 * u, 2.4 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function laptopScreenTexture(): { texture: CanvasTexture; canvas: HTMLCanvasElement } {
  const [c, ctx] = canvas(512, 320);
  ctx.fillStyle = '#0b1a33';
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = 'rgba(90,170,255,0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 320);
    ctx.stroke();
  }
  for (let y = 0; y < 320; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  // CAD phone wireframe.
  ctx.strokeStyle = '#6fd3ff';
  ctx.lineWidth = 3;
  roundRect(ctx, 190, 40, 130, 240, 24);
  ctx.stroke();
  ctx.lineWidth = 2;
  roundRect(ctx, 202, 70, 106, 170, 6);
  ctx.stroke();
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(150, 160);
  ctx.lineTo(360, 160);
  ctx.moveTo(255, 20);
  ctx.lineTo(255, 300);
  ctx.stroke();
  ctx.setLineDash([]);
  // Side panels.
  ctx.fillStyle = 'rgba(30,60,110,0.9)';
  roundRect(ctx, 12, 14, 120, 292, 8);
  ctx.fill();
  roundRect(ctx, 380, 14, 120, 292, 8);
  ctx.fill();
  ctx.fillStyle = '#6fd3ff';
  for (let i = 0; i < 9; i++) ctx.fillRect(24, 30 + i * 30, 40 + ((i * 37) % 60), 8);
  ctx.fillStyle = '#ffb84d';
  for (let i = 0; i < 6; i++) ctx.fillRect(392, 30 + i * 44, 90 - ((i * 23) % 50), 10);
  return { texture: tex(c), canvas: c };
}

export function posterTexture(): Texture {
  const [c, ctx] = canvas(256, 360);
  const g = ctx.createLinearGradient(0, 0, 256, 360);
  g.addColorStop(0, '#ff7a64');
  g.addColorStop(1, '#6a3bd1');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 360);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(128, 150, 30 + i * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#14162a';
  roundRect(ctx, 93, 70, 70, 140, 14);
  ctx.fill();
  ctx.fillStyle = '#7fe0ff';
  roundRect(ctx, 100, 84, 56, 108, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 38px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUILD', 128, 270);
  ctx.fillText('BOLD', 128, 312);
  return tex(c);
}

export function whiteboardTexture(): Texture {
  const [c, ctx] = canvas(512, 340);
  ctx.fillStyle = '#f7f7f4';
  ctx.fillRect(0, 0, 512, 340);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const sketch = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    roundRect(ctx, x, y, w, h, w * 0.18);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    roundRect(ctx, x + w * 0.1, y + h * 0.14, w * 0.8, h * 0.7, 4);
    ctx.stroke();
  };
  sketch(40, 50, 80, 150, '#2b59c3');
  sketch(160, 60, 70, 140, '#2b59c3');
  ctx.strokeStyle = '#d33';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(195, 130, 64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.font = '600 30px "Comic Sans MS", "Marker Felt", cursive';
  ctx.fillText('v1 !!', 260, 90);
  ctx.font = '500 22px "Comic Sans MS", "Marker Felt", cursive';
  ctx.fillText('thinner?', 260, 140);
  ctx.fillText('battery ↑', 260, 175);
  ctx.strokeStyle = '#2a2';
  ctx.beginPath();
  ctx.moveTo(250, 220);
  ctx.quadraticCurveTo(330, 200, 400, 250);
  ctx.stroke();
  // Sticky notes.
  const notes: [number, number, string][] = [
    [400, 30, '#ffe46b'],
    [430, 120, '#ff9ec7'],
    [60, 240, '#8fe3ff'],
  ];
  for (const [x, y, col] of notes) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 70, 70);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 10, y + 20, 45, 4);
    ctx.fillRect(x + 10, y + 34, 35, 4);
  }
  return tex(c);
}

export function rugTexture(): Texture {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#2f3a6b';
  ctx.fillRect(0, 0, 256, 256);
  const rings = ['#3d4c86', '#e9b65b', '#2f3a6b', '#3d4c86'];
  rings.forEach((col, i) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 120 - i * 18, 0, Math.PI * 2);
    ctx.stroke();
  });
  return tex(c);
}
