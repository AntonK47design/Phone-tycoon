// Flagship store diorama (M5): display islands with the company's phones, a logo wall,
// and shoppers strolling between the tables. Everything moving is instanced.

import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { woodTexture } from '../textures';
import { StaticBatcher } from './batch';
import { pendantLamp, plant, type Kit } from './props';
import { neonTexture } from './officeCorner';

export const STORE_ORIGIN = new Vector3(0, 0, -15);

export interface StoreVisual {
  /** Stores owned worldwide (0 = no store yet). */
  stores: number;
  /** Colours of the phones on sale (newest first). */
  phones: string[];
  companyName: string;
}

const W = 9;
const D = 6.5;
const TABLES = 4;
const PHONES_PER_TABLE = 6;
const SHOPPERS = 12;
const SHIRTS = ['#ff7aa8', '#4f7cff', '#3cc48a', '#ffb020', '#b18cff', '#ff6a2a', '#2bb3a8', '#e9e9e9'].map((c) => new Color(c));

function screenWall(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, '#ff5a1f');
  g.addColorStop(1, '#7a3cff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = '900 54px Impact, "Arial Black", sans-serif';
  ctx.fillText('NEW', 40, 110);
  ctx.font = '700 28px sans-serif';
  ctx.fillText('in stores now', 42, 150);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.roundRect(330, 30, 110, 200, 18);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.roundRect(338, 40, 94, 180, 12);
  ctx.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface Shopper {
  angle: number;
  radius: number;
  table: number;
  speed: number;
  pause: number;
}

export class Store {
  readonly root = new Group();
  private statics = new Group();
  private phones: InstancedMesh;
  private bodies: InstancedMesh;
  private heads: InstancedMesh;
  private signMat = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  private screenMat: MeshBasicMaterial;
  private mats: Material[] = [];
  private disposables: { dispose(): void }[] = [];
  private shown = false;
  private visual: StoreVisual | null = null;
  private signText = '';
  private tables: Vector3[] = [];
  private shoppers: Shopper[] = [];

  constructor() {
    this.root.position.copy(STORE_ORIGIN);
    this.root.add(this.statics);
    const mat = (color: string, roughness = 0.5, metalness = 0) => {
      const m = new MeshStandardMaterial({ color, roughness, metalness });
      this.mats.push(m);
      return m;
    };
    const inst = (geo: BufferGeometry, m: Material, n: number) => {
      const im = new InstancedMesh(geo, m, n);
      im.castShadow = true;
      im.count = 0;
      im.frustumCulled = false;
      for (let i = 0; i < n; i++) im.setColorAt(i, new Color('#fff'));
      this.root.add(im);
      return im;
    };
    this.phones = inst(new RoundedBoxGeometry(0.14, 0.27, 0.02, 2, 0.01), mat('#ffffff', 0.2, 0.2), TABLES * PHONES_PER_TABLE);
    const body = new CapsuleGeometry(0.14, 0.5, 4, 10);
    body.translate(0, 0.62, 0);
    this.bodies = inst(body, mat('#ffffff', 0.8), SHOPPERS);
    this.heads = inst(new SphereGeometry(0.11, 14, 10), mat('#ffffff', 0.7), SHOPPERS);
    this.signMat.color.setScalar(2.4);
    this.screenMat = new MeshBasicMaterial({ map: screenWall() });
    this.screenMat.color.setScalar(1.4);
    this.build();
    for (let i = 0; i < SHOPPERS; i++) {
      this.shoppers.push({ angle: (i / SHOPPERS) * Math.PI * 2 * 3, radius: 0.85 + (i % 3) * 0.12, table: i % TABLES, speed: 0.25 + (i % 4) * 0.08, pause: 0 });
      this.bodies.setColorAt(i, SHIRTS[i % SHIRTS.length]);
      this.heads.setColorAt(i, new Color(['#f1c9a5', '#e0ac7e', '#c68b5b', '#9a6440', '#6b4428'][i % 5]));
    }
    this.root.visible = false;
  }

  private build() {
    const keep = <T extends { dispose(): void }>(x: T) => (this.disposables.push(x), x);
    const std = (color: string, roughness = 0.6, metalness = 0, extra: Partial<MeshStandardMaterial> = {}) =>
      keep(new MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.5, ...extra }));
    const M = {
      slab: std('#2a2e44', 0.9),
      slabTop: std('#3a3f5c', 0.8),
      floor: std('#ffffff', 0.4, 0, { map: keep(woodTexture('#e9dcc6')) }),
      wall: std('#f5f2ec', 0.85),
      wallLeft: std('#ebe6dc', 0.85),
      table: std('#f7f7f5', 0.35),
      tableBase: std('#d9d9d6', 0.4, 0.4),
      counter: std('#1d1f26', 0.4),
      plant: std('#3f9a5b', 0.75),
      pot: std('#e8e2d6', 0.6),
      shelf: std('#c9a27a', 0.6),
      tableTop: std('#ffffff', 0.45, 0, { map: keep(woodTexture('#d8b48a')) }),
      slatwall: std('#3a3f4a', 0.8),
      featureWall: std('#1d1f26', 0.7),
      plantDark: std('#2e7a46', 0.75),
      potWarm: std('#c96f4a', 0.8),
      accA: std('#ff5a1f', 0.6),
      accB: std('#4f7cff', 0.6),
      accC: std('#ffd23f', 0.6),
      accD: std('#2bb3a8', 0.6),
      accE: std('#ff7aa8', 0.6),
      cable: std('#1d1f26', 0.6),
      globe: std('#fff6e0', 0.3, 0, { emissive: new Color('#ffe2a8'), emissiveIntensity: 1.6 }),
      gate: std('#e8ecef', 0.3, 0.3),
      mat: std('#2b2f3a', 0.95),
      screen: std('#0e2236', 0.3, 0, { emissive: new Color('#7fb2ff'), emissiveIntensity: 0.8 }),
    };
    const batch = new StaticBatcher();
    const tmp = new Group();
    const box = (w: number, h: number, d: number, m: Material, x: number, y: number, z: number, r = 0.02) => {
      const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
      const mesh = new Mesh(geo, m);
      mesh.position.set(x, y, z);
      tmp.add(mesh);
      batch.add(mesh);
      tmp.remove(mesh);
      geo.dispose();
    };
    const x0 = -W / 2;
    const z0 = -D / 2;
    box(W + 0.4, 0.42, D + 0.4, M.slab, 0, -0.23, 0, 0.06);
    box(W + 0.44, 0.05, D + 0.44, M.slabTop, 0, -0.03, 0, 0.02);
    const floor = new Mesh(keep(new PlaneGeometry(W, D)), M.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.receiveShadow = true;
    this.statics.add(floor);
    box(W + 0.2, 3.2, 0.2, M.wall, -0.1, 1.6, z0 - 0.1, 0);
    box(0.2, 3.2, D, M.wallLeft, x0 - 0.1, 1.6, 0, 0);
    // Wall shelves with accessories, a cash counter, plants.
    for (let i = 0; i < 3; i++) box(0.3, 0.04, 1.4, M.shelf, x0 + 0.17, 1.1 + i * 0.45, -0.6, 0.01);
    box(2.2, 1.0, 0.6, M.counter, W / 2 - 1.6, 0.5, z0 + 0.8, 0.04);
    box(2.3, 0.05, 0.7, M.table, W / 2 - 1.6, 1.02, z0 + 0.8, 0.02);
    const kit: Kit = {
      box: (bw, bh, bd, m, x, y, z, r = 0.02) => box(bw, bh, bd, m, x, y, z, r),
      cyl: (rt, rb, h, m, x, y, z, seg = 16) => {
        const mesh = new Mesh(new CylinderGeometry(rt, rb, h, seg), m);
        mesh.position.set(x, y, z);
        tmp.add(mesh);
        batch.add(mesh);
        tmp.remove(mesh);
        mesh.geometry.dispose();
      },
      sphere: (r, m, x, y, z) => {
        const mesh = new Mesh(new SphereGeometry(r, 12, 10), m);
        mesh.position.set(x, y, z);
        tmp.add(mesh);
        batch.add(mesh);
        tmp.remove(mesh);
        mesh.geometry.dispose();
      },
    };
    const plantMats = { pot: M.potWarm, leaf: M.plant, leafDark: M.plantDark };
    plant(kit, plantMats, x0 + 0.5, D / 2 - 0.5, 1.1);
    plant(kit, plantMats, W / 2 - 0.5, D / 2 - 0.5, 1.1);
    // Accessory wall: slatwall panel behind the shelves, colourful boxes on them.
    box(0.04, 1.6, 1.8, M.slatwall, x0 + 0.03, 1.55, -0.6, 0.01);
    const accs = [M.accA, M.accB, M.accC, M.accD, M.accE];
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 5; k++) box(0.16, 0.2 - (k % 2) * 0.04, 0.18, accs[(i + k) % accs.length], x0 + 0.2, 1.22 + i * 0.45 - (k % 2) * 0.02, -1.15 + k * 0.27, 0.02);
    }
    // Dark feature panel so the neon logo reads, and a till on the counter.
    box(2.6, 1.0, 0.04, M.featureWall, 2.4, 2.4, z0 + 0.02, 0.02);
    box(0.36, 0.22, 0.3, M.counter, W / 2 - 2.1, 1.16, z0 + 0.8, 0.02);
    box(0.3, 0.2, 0.02, M.screen, W / 2 - 2.1, 1.38, z0 + 0.74, 0.01);
    box(0.24, 0.16, 0.02, M.screen, W / 2 - 1.2, 1.15, z0 + 0.62, 0.01);
    // Entrance: doormat and two security gates.
    box(1.6, 0.012, 0.7, M.mat, 0, 0.008, D / 2 - 0.4, 0.004);
    for (const gx of [-0.95, 0.95]) box(0.08, 1.2, 0.4, M.gate, gx, 0.6, D / 2 - 0.45, 0.03);
    // Display islands.
    this.tables = [];
    for (let i = 0; i < TABLES; i++) {
      const x = -1.9 + (i % 2) * 3.2;
      const z = -0.9 + Math.floor(i / 2) * 2.2;
      box(1.5, 0.06, 0.8, M.tableTop, x, 0.88, z, 0.03);
      for (const dx of [-0.45, 0.45]) pendantLamp(kit, { cable: M.cable, shade: M.globe, bulb: M.globe }, x + dx, z, 3.2, 2.35, 0.1);
      box(1.1, 0.85, 0.4, M.tableBase, x, 0.43, z, 0.04);
      this.tables.push(new Vector3(x, 0, z));
    }
    batch.flush(this.statics);
    // Promo wall screen and neon logo.
    const screen = new Mesh(keep(new PlaneGeometry(3.2, 1.6)), this.screenMat);
    screen.position.set(-1.2, 1.9, z0 + 0.01);
    this.statics.add(screen);
    const sign = new Mesh(keep(new PlaneGeometry(2.2, 0.66)), this.signMat);
    sign.position.set(2.4, 2.4, z0 + 0.06);
    this.statics.add(sign);
  }

  setShown(on: boolean) {
    this.shown = on;
    this.root.visible = on && (this.visual?.stores ?? 0) > 0;
  }

  setVisual(v: StoreVisual) {
    this.visual = v;
    this.root.visible = this.shown && v.stores > 0;
    if (v.companyName !== this.signText) {
      this.signText = v.companyName;
      this.signMat.map?.dispose();
      this.signMat.map = neonTexture(v.companyName);
      this.signMat.needsUpdate = true;
    }
    // Phones stand on the islands in rows, newest models first.
    const m = new Matrix4();
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.35);
    let n = 0;
    const colors = v.phones.length ? v.phones : ['#cccccc'];
    this.tables.forEach((tp, ti) => {
      for (let k = 0; k < PHONES_PER_TABLE; k++) {
        const col = colors[(ti * 2 + Math.floor(k / 3)) % colors.length];
        const x = tp.x - 0.55 + (k % 3) * 0.55;
        const z = tp.z + (k < 3 ? -0.18 : 0.18);
        this.phones.setMatrixAt(n, m.compose(new Vector3(x, 1.03, z), q, new Vector3(1, 1, 1)));
        this.phones.setColorAt(n, new Color(col));
        n++;
      }
    });
    this.phones.count = n;
    this.phones.instanceMatrix.needsUpdate = true;
    if (this.phones.instanceColor) this.phones.instanceColor.needsUpdate = true;
  }

  update(t: number, dt: number): boolean {
    if (!this.root.visible) return false;
    const m = new Matrix4();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const crowd = Math.min(SHOPPERS, 4 + (this.visual?.stores ?? 0) * 2);
    for (let i = 0; i < crowd; i++) {
      const s = this.shoppers[i];
      // Stroll around a table, stop to look at a phone now and then.
      if (s.pause > 0) s.pause -= dt;
      else {
        s.angle += dt * s.speed;
        if (Math.sin(t * 0.7 + i * 2.1) > 0.97) s.pause = 1.5 + (i % 3);
        if (Math.sin(t * 0.13 + i) > 0.995) s.table = (s.table + 1) % TABLES;
      }
      const c = this.tables[s.table];
      const p = new Vector3(c.x + Math.cos(s.angle) * s.radius * 1.1, Math.abs(Math.sin(t * 7 + i)) * (s.pause > 0 ? 0 : 0.03), c.z + Math.sin(s.angle) * s.radius * 0.75);
      q.setFromAxisAngle(new Vector3(0, 1, 0), -s.angle);
      this.bodies.setMatrixAt(i, m.compose(p, q, one));
      this.heads.setMatrixAt(i, m.compose(p.clone().setY(p.y + 1.15), q, one));
    }
    this.bodies.count = this.heads.count = crowd;
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    this.signMat.color.setScalar(2.2 + Math.sin(t * 3) * 0.1);
    return true;
  }

  dispose() {
    this.statics.traverse((o) => (o as Mesh).geometry?.dispose());
    this.disposables.forEach((d) => d.dispose());
    for (const im of [this.phones, this.bodies, this.heads]) {
      im.geometry.dispose();
      im.dispose();
    }
    this.mats.forEach((m) => m.dispose());
    this.signMat.map?.dispose();
    this.signMat.dispose();
    this.screenMat.map?.dispose();
    this.screenMat.dispose();
  }
}
