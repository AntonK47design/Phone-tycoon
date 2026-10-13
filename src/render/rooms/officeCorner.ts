// Phase-2 upgrade inside the garage: a proper desk, monitors, cooler and a neon sign.
// (The full office diorama follows in M3.)

import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeChildren } from '../mergeChildren';
import { roundRect } from '../textures';

export function neonTexture(text: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 160);
  ctx.font = '900 82px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff6a2a';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffd9a8';
  ctx.fillText(text.toUpperCase(), 256, 84, 480);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff4e2';
  ctx.fillText(text.toUpperCase(), 256, 84, 480);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function monitorTexture(kind: 'chart' | 'code'): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = kind === 'chart' ? '#0f2a24' : '#14161f';
  ctx.fillRect(0, 0, 256, 160);
  if (kind === 'chart') {
    ctx.strokeStyle = '#46f08e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const pts = [130, 120, 125, 100, 104, 80, 86, 60, 44, 30];
    pts.forEach((y, i) => (i ? ctx.lineTo(20 + i * 24, y) : ctx.moveTo(20, y)));
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 6; i++) ctx.fillRect(24 + i * 38, 140 - i * 9, 22, 12 + i * 9);
  } else {
    const cols = ['#ff7a64', '#7fdcff', '#ffd23f', '#b18cff', '#a7e07a'];
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = cols[i % cols.length];
      roundRect(ctx, 14 + (i % 3) * 12, 12 + i * 12, 40 + ((i * 53) % 150), 6, 3);
      ctx.fill();
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class OfficeCorner {
  readonly group = new Group();
  private signMat: MeshBasicMaterial;
  private mats: Material[] = [];
  private signText = '';

  constructor() {
    const std = (color: string, roughness = 0.6, metalness = 0) => {
      const m = new MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.5 });
      this.mats.push(m);
      return m;
    };
    const box = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, r = 0.02) => {
      const m = new Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    const desk = std('#f4f0e6', 0.5);
    const leg = std('#2b2f3a', 0.4, 0.6);
    const chair = std('#ff5a1f', 0.7);
    const metal = std('#9aa1aa', 0.35, 0.8);

    // Desk near the garage door, facing the room.
    const dx = 2.55;
    const dz = -0.75;
    box(0.75, 0.05, 1.5, desk, dx, 0.76, dz);
    for (const zz of [dz - 0.68, dz + 0.68]) box(0.65, 0.74, 0.04, leg, dx, 0.37, zz, 0.01);
    // Two monitors.
    const screens: [number, 'chart' | 'code'][] = [[dz - 0.32, 'chart'], [dz + 0.32, 'code']];
    for (const [zz, kind] of screens) {
      box(0.05, 0.34, 0.56, leg, dx + 0.22, 1.12, zz, 0.015);
      box(0.04, 0.2, 0.04, leg, dx + 0.26, 0.88, zz, 0.01);
      const tex = monitorTexture(kind);
      const mat = new MeshBasicMaterial({ map: tex });
      mat.color.setScalar(1.6);
      this.mats.push(mat);
      const scr = new Mesh(new PlaneGeometry(0.52, 0.3), mat);
      scr.position.set(dx + 0.193, 1.12, zz);
      scr.rotation.y = -Math.PI / 2;
      this.group.add(scr);
    }
    box(0.14, 0.02, 0.4, leg, dx - 0.12, 0.79, dz, 0.008); // keyboard
    // Office chair.
    box(0.42, 0.08, 0.42, chair, dx - 0.55, 0.5, dz, 0.04);
    box(0.08, 0.5, 0.42, chair, dx - 0.78, 0.8, dz, 0.04);
    const pole = new Mesh(new CylinderGeometry(0.025, 0.025, 0.4, 10), metal);
    pole.position.set(dx - 0.55, 0.26, dz);
    this.group.add(pole);
    const base = new Mesh(new CylinderGeometry(0.24, 0.26, 0.04, 20), leg);
    base.position.set(dx - 0.55, 0.03, dz);
    this.group.add(base);

    // Filing cabinet and water cooler.
    box(0.45, 0.9, 0.5, metal, 3.2, 0.45, 0.35, 0.02);
    for (let i = 0; i < 3; i++) box(0.02, 0.03, 0.2, leg, 2.96, 0.2 + i * 0.28, 0.35, 0.01);
    box(0.32, 0.9, 0.32, std('#f4f0e6', 0.5), 3.2, 0.45, 1.05, 0.03);
    const bottle = new Mesh(new CylinderGeometry(0.13, 0.13, 0.42, 20), new MeshStandardMaterial({ color: '#7fc8ff', roughness: 0.1, transparent: true, opacity: 0.7 }));
    bottle.position.set(3.2, 1.11, 1.05);
    this.group.add(bottle);

    // Neon company sign on the back wall.
    this.signMat = new MeshBasicMaterial({ transparent: true, depthWrite: false });
    this.signMat.color.setScalar(2.4);
    const sign = new Mesh(new PlaneGeometry(1.6, 0.5), this.signMat);
    sign.position.set(1.95, 2.72, -2.92);
    this.group.add(sign);
    mergeChildren(this.group, { colored: 'single' });
    this.group.visible = false;
  }

  setVisible(on: boolean, companyName: string) {
    this.group.visible = on;
    if (on && companyName !== this.signText) {
      this.signText = companyName;
      this.signMat.map?.dispose();
      this.signMat.map = neonTexture(companyName);
      this.signMat.needsUpdate = true;
    }
  }

  update(t: number) {
    if (!this.group.visible) return;
    // Neon flicker now and then.
    const flick = Math.sin(t * 37) > 0.995 ? 0.4 : 1;
    this.signMat.color.setScalar(2.2 * flick + Math.sin(t * 3) * 0.1);
  }

  dispose() {
    this.group.traverse((o) => (o as Mesh).geometry?.dispose());
    this.mats.forEach((m) => m.dispose());
    this.signMat.map?.dispose();
    this.signMat.dispose();
  }
}
