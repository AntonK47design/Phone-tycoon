// Startup office diorama (M3): grows over four levels, desks in pods per team, a lab
// corner and a design studio corner. Static parts are batched per level; screens and
// people are instanced.

import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROLE_COLORS, type Role } from '../../data/team';
import { Crowd, type SeatSpot, type StaffVisual } from '../characters/Crowd';
import { roundRect, skyTexture, woodTexture } from '../textures';
import { StaticBatcher } from './batch';
import { neonTexture } from './officeCorner';

export const OFFICE_ORIGIN = new Vector3(12, 0, 0);

export interface OfficeVisual {
  level: number;
  lab: number;
  studio: number;
  companyName: string;
  staff: StaffVisual[];
  /** A phone is in development (busier team, brighter screens). */
  busy: boolean;
}

interface Layout {
  w: number;
  d: number;
  /** Pod rows: z of the pod centre line and the x of each pod. */
  pods: { x: number; z: number }[];
}

const POD_W = 1.2;
const POD_PITCH = 1.75;

/** Room size and pod placement per office level (seats = 2 per pod). */
export function officeLayout(level: number): Layout {
  const spec = [
    { w: 6.5, d: 5.2, rows: [2] },
    { w: 8.5, d: 6, rows: [4] },
    { w: 10.5, d: 7.6, rows: [4, 3] },
    { w: 13, d: 8.4, rows: [6, 6] },
  ][Math.max(0, Math.min(3, level - 1))];
  const pods: Layout['pods'] = [];
  spec.rows.forEach((n, r) => {
    const z = -spec.d / 2 + 1.75 + r * 2.5;
    // Pods sit right of centre: the left side keeps space for the lounge / lab.
    const span = (n - 1) * POD_PITCH;
    const cx = spec.w / 2 - 0.9 - POD_W / 2 - span / 2 - (spec.w > 8 ? 0.4 : 0);
    for (let i = 0; i < n; i++) pods.push({ x: cx - span / 2 + i * POD_PITCH, z });
  });
  return { w: spec.w, d: spec.d, pods };
}

/** Seat spots in pod order: back seat, then front seat of each pod. */
export function officeSeats(level: number): SeatSpot[] {
  const { d, pods } = officeLayout(level);
  const aisleZ = d / 2 - 0.55;
  const out: SeatSpot[] = [];
  for (const p of pods) {
    const gapX = p.x + POD_W / 2 + (POD_PITCH - POD_W) / 2;
    for (const side of [-1, 1]) {
      const pos = new Vector3(p.x, 0, p.z + side * 0.92);
      const behind = new Vector3(p.x, 0, p.z + side * 1.25);
      const exit = side > 0 ? [behind, new Vector3(p.x, 0, aisleZ)] : [behind, new Vector3(gapX, 0, behind.z), new Vector3(gapX, 0, aisleZ)];
      out.push({ pos, dir: new Vector3(0, 0, -side), exit });
    }
  }
  return out;
}

function screenTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a3d48';
  ctx.fillRect(0, 0, 128, 80);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, 0, 128, 10);
  ctx.globalAlpha = 0.75;
  for (let i = 0; i < 6; i++) {
    roundRect(ctx, 8 + (i % 2) * 6, 16 + i * 10, 30 + ((i * 37) % 70), 5, 2.5);
    ctx.fill();
  }
  ctx.globalAlpha = 0.5;
  roundRect(ctx, 86, 18, 34, 54, 4);
  ctx.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function boardTexture(kind: 'mood' | 'plan'): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = kind === 'mood' ? '#f2ebe0' : '#f7f7f4';
  ctx.fillRect(0, 0, 256, 160);
  if (kind === 'mood') {
    const cols = ['#ff7aa8', '#ffd23f', '#3cc48a', '#4f7cff', '#b18cff', '#ff6a2a', '#2bb3a8', '#1b1d24'];
    cols.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(30 + (i % 4) * 62, 40 + Math.floor(i / 4) * 70);
      ctx.rotate(((i * 37) % 11) / 60 - 0.08);
      ctx.fillRect(-22, -26, 44, 52);
      ctx.restore();
    });
  } else {
    ctx.strokeStyle = '#2b2f3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 130);
    [[60, 110], [100, 118], [140, 80], [180, 70], [230, 30]].forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
    ctx.fillStyle = '#ff5a1f';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Q3 ↑', 24, 34);
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 4; i++) ctx.fillRect(160 + (i % 2) * 40, 92 + Math.floor(i / 2) * 30, 34, 24);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Office {
  readonly root = new Group();
  readonly crowd = new Crowd();
  private statics = new Group();
  private disposables: { dispose(): void }[] = [];
  private screens: InstancedMesh;
  private screenMat: MeshBasicMaterial;
  private signMat: MeshBasicMaterial;
  private signText = '';
  private seatSpots: SeatSpot[] = [];
  private staffBySeat: (StaffVisual | null)[] = [];
  private buildKey = '';
  private busy = false;
  private labGlow: MeshStandardMaterial;

  constructor() {
    this.root.position.copy(OFFICE_ORIGIN);
    this.root.add(this.statics, this.crowd.group);
    this.screenMat = new MeshBasicMaterial({ map: screenTexture() });
    this.screens = new InstancedMesh(new PlaneGeometry(0.5, 0.3), this.screenMat, 24);
    this.screens.count = 0;
    this.screens.frustumCulled = false;
    for (let i = 0; i < 24; i++) this.screens.setColorAt(i, new Color('#000'));
    this.root.add(this.screens);
    this.signMat = new MeshBasicMaterial({ transparent: true, depthWrite: false });
    this.signMat.color.setScalar(2.4);
    this.labGlow = new MeshStandardMaterial({ color: '#b18cff', emissive: '#9a6bff', emissiveIntensity: 2.2, roughness: 0.2 });
    this.root.visible = false;
  }

  setVisual(v: OfficeVisual) {
    this.root.visible = v.level > 0;
    if (v.level < 1) return;
    const key = `${v.level}|${v.lab}|${v.studio}`;
    if (key !== this.buildKey) {
      this.buildKey = key;
      this.build(v.level, v.lab, v.studio);
    }
    if (v.companyName !== this.signText) {
      this.signText = v.companyName;
      this.signMat.map?.dispose();
      this.signMat.map = neonTexture(v.companyName);
      this.signMat.needsUpdate = true;
    }
    this.busy = v.busy;
    // Teams cluster: staff sorted by role fill the pods in order.
    const order: Role[] = ['designer', 'engineer', 'programmer', 'researcher', 'marketer'];
    const staff = [...v.staff].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.id - b.id).slice(0, this.seatSpots.length);
    this.staffBySeat = this.seatSpots.map((_, i) => staff[i] ?? null);
    this.crowd.set(staff, this.seatSpots);
  }

  private build(level: number, lab: number, studio: number) {
    // Dispose the previous level.
    this.statics.traverse((o) => (o as Mesh).geometry?.dispose());
    this.statics.clear();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    const keep = <T extends { dispose(): void }>(x: T) => (this.disposables.push(x), x);
    const std = (color: string, roughness = 0.7, metalness = 0, extra: Partial<MeshStandardMaterial> = {}) =>
      keep(new MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.45, ...extra }));
    const batch = new StaticBatcher();
    const tmp = new Group();
    const place = (geo: BufferGeometry, mat: Material, x: number, y: number, z: number, rotY = 0, opts?: { castShadow?: boolean }) => {
      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      tmp.add(mesh);
      batch.add(mesh, opts);
      tmp.remove(mesh);
      geo.dispose();
      return mesh;
    };
    const box = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, r = 0.02, rotY = 0) =>
      place(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new BoxGeometry(w, h, d), mat, x, y, z, rotY);
    const cyl = (rt: number, rb: number, h: number, mat: Material, x: number, y: number, z: number, seg = 18) =>
      place(new CylinderGeometry(rt, rb, h, seg), mat, x, y, z);

    const M = {
      slab: std('#2a2e44', 0.9),
      slabTop: std('#3a3f5c', 0.8),
      floor: std('#ffffff', 0.62, 0, { map: keep(woodTexture('#c99a6b')) }),
      wallBack: std(level >= 3 ? '#e9e4da' : '#d8cdbd', 0.92),
      wallLeft: std(level >= 3 ? '#dcd5c8' : '#cbbfae', 0.92),
      accent: std(['#ff5a1f', '#2bb3a8', '#4f7cff', '#1b1d24'][level - 1], 0.85),
      cap: std('#f7f0e6', 0.7),
      desk: std('#f4f0e6', 0.5),
      leg: std('#2b2f3a', 0.4, 0.6),
      monitor: std('#1b1d24', 0.35, 0.2),
      chair: std('#3a3f4a', 0.7),
      chairSeat: std(level >= 2 ? '#ff5a1f' : '#596070', 0.75),
      plant: std('#3f9a5b', 0.75),
      plantDark: std('#2e7a46', 0.75),
      pot: std('#c96f4a', 0.8),
      white: std('#f2f2f2', 0.5),
      sofa: std('#4f7cff', 0.9),
      sofaDark: std('#3b5fc8', 0.9),
      wood: std('#ffffff', 0.55, 0, { map: keep(woodTexture('#8a5a36')) }),
      metal: std('#b8bec7', 0.3, 0.85),
      rug: std('#f2c14e', 0.95),
      frame: std('#f5f5f0', 0.5),
      yellow: std('#ffd23f', 0.6),
      labBench: std('#e8eef2', 0.35, 0.1),
      mood: std('#ffffff', 0.8, 0, { map: keep(boardTexture('mood')) }),
      plan: std('#ffffff', 0.6, 0, { map: keep(boardTexture('plan')) }),
    };
    const { w, d, pods } = officeLayout(level);
    const x0 = -w / 2;
    const z0 = -d / 2;
    const wallH = 3;
    const wallT = 0.18;

    // Slab, floor, walls.
    box(w + 0.4, 0.42, d + 0.4, M.slab, 0, -0.23, 0, 0.06);
    box(w + 0.44, 0.05, d + 0.44, M.slabTop, 0, -0.03, 0, 0.02);
    const floor = new Mesh(keep(new PlaneGeometry(w, d)), M.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.receiveShadow = true;
    this.statics.add(floor);
    const bz = z0 - wallT / 2;
    // Back wall with a row of tall windows.
    const winCount = Math.max(2, Math.floor(w / 2.6));
    const winW = 1.3;
    const winY0 = 0.9;
    const winY1 = 2.5;
    const winXs = Array.from({ length: winCount }, (_, i) => x0 + (w / winCount) * (i + 0.5));
    let cursor = x0 - wallT;
    for (const wx of winXs) {
      box(wx - winW / 2 - cursor, wallH, wallT, M.wallBack, (cursor + wx - winW / 2) / 2, wallH / 2, bz, 0);
      box(winW, winY0, wallT, M.wallBack, wx, winY0 / 2, bz, 0);
      box(winW, wallH - winY1, wallT, M.wallBack, wx, (winY1 + wallH) / 2, bz, 0);
      box(winW + 0.06, 0.06, wallT + 0.04, M.frame, wx, winY0, bz, 0.01);
      box(winW + 0.06, 0.06, wallT + 0.04, M.frame, wx, winY1, bz, 0.01);
      box(0.04, winY1 - winY0, 0.05, M.frame, wx, (winY0 + winY1) / 2, bz, 0.01);
      cursor = wx + winW / 2;
    }
    box(w / 2 - cursor, wallH, wallT, M.wallBack, (cursor + w / 2) / 2, wallH / 2, bz, 0);
    box(w + wallT, 0.04, wallT + 0.02, M.cap, -wallT / 2, wallH + 0.02, bz, 0);
    const sky = keep(new MeshBasicMaterial({ map: keep(skyTexture()) }));
    const skyPlane = new Mesh(keep(new PlaneGeometry(w, 2)), sky);
    skyPlane.position.set(0, (winY0 + winY1) / 2, z0 - 0.7);
    this.statics.add(skyPlane);
    const glass = keep(new MeshPhysicalMaterial({ color: '#cfe6ff', roughness: 0.05, transparent: true, opacity: 0.16 }));
    for (const wx of winXs) {
      const pane = new Mesh(keep(new PlaneGeometry(winW, winY1 - winY0)), glass);
      pane.position.set(wx, (winY0 + winY1) / 2, bz);
      this.statics.add(pane);
    }
    const lx = x0 - wallT / 2;
    box(wallT, wallH, d, M.wallLeft, lx, wallH / 2, 0, 0);
    box(wallT + 0.02, 0.04, d, M.cap, lx, wallH + 0.02, 0, 0);
    // Accent stripe in the company colour.
    box(0.02, 0.35, d, M.accent, x0 + 0.01, 1.1, 0, 0);
    box(w, 0.09, 0.03, M.cap, 0, 0.045, z0 + 0.015, 0);

    // Desks: two per pod, facing each other.
    const seats = officeSeats(level);
    this.seatSpots = seats;
    const screenM: Matrix4[] = [];
    for (const p of pods) {
      box(POD_W + 0.04, 0.3, 0.04, M.accent, p.x, 0.95, p.z, 0.01); // divider
      for (const side of [-1, 1]) {
        const dz = p.z + side * 0.33;
        box(POD_W, 0.05, 0.64, M.desk, p.x, 0.74, dz, 0.015);
        box(0.05, 0.72, 0.6, M.leg, p.x - POD_W / 2 + 0.06, 0.36, dz, 0.01);
        box(0.05, 0.72, 0.6, M.leg, p.x + POD_W / 2 - 0.06, 0.36, dz, 0.01);
        // Monitor facing the seat.
        box(0.54, 0.34, 0.04, M.monitor, p.x, 1.08, p.z + side * 0.1, 0.012);
        box(0.05, 0.2, 0.05, M.monitor, p.x, 0.86, p.z + side * 0.12, 0.01);
        box(0.36, 0.015, 0.12, M.monitor, p.x, 0.775, p.z + side * 0.48, 0.005);
        const sm = new Matrix4().compose(
          new Vector3(p.x, 1.08, p.z + side * 0.123),
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), side > 0 ? 0 : Math.PI),
          new Vector3(1, 1, 1),
        );
        screenM.push(sm);
        // Chair.
        const cz = p.z + side * 0.92;
        box(0.42, 0.07, 0.42, M.chairSeat, p.x, 0.47, cz, 0.03);
        box(0.42, 0.45, 0.07, M.chairSeat, p.x, 0.74, cz + side * 0.22, 0.03);
        cyl(0.025, 0.025, 0.4, M.metal, p.x, 0.25, cz, 8);
        cyl(0.22, 0.24, 0.04, M.chair, p.x, 0.03, cz, 16);
      }
      // Desk props.
      cyl(0.04, 0.035, 0.09, M.white, p.x + 0.42, 0.81, p.z - 0.4, 12);
      place(new SphereGeometry(0.08, 10, 8), M.plant, p.x - 0.45, 0.88, p.z + 0.45);
      cyl(0.06, 0.05, 0.1, M.pot, p.x - 0.45, 0.8, p.z + 0.45, 12);
    }
    screenM.forEach((m, i) => this.screens.setMatrixAt(i, m));
    this.screens.count = screenM.length;
    this.screens.instanceMatrix.needsUpdate = true;

    // Lounge / kitchen along the left wall.
    const waypoints: Vector3[] = [];
    const coolerZ = z0 + 0.7;
    box(0.32, 0.9, 0.32, M.white, x0 + 0.35, 0.45, coolerZ, 0.03);
    const bottle = new Mesh(keep(new CylinderGeometry(0.13, 0.13, 0.42, 18)), keep(new MeshStandardMaterial({ color: '#7fc8ff', roughness: 0.1, transparent: true, opacity: 0.7 })));
    bottle.position.set(x0 + 0.35, 1.11, coolerZ);
    this.statics.add(bottle);
    waypoints.push(new Vector3(x0 + 0.85, 0, coolerZ + 0.2));
    // Coffee counter.
    const counterZ = coolerZ + 1.1;
    box(0.6, 0.9, 1.1, M.wood, x0 + 0.32, 0.45, counterZ, 0.02);
    box(0.62, 0.04, 1.14, M.white, x0 + 0.32, 0.92, counterZ, 0.01);
    box(0.28, 0.36, 0.26, M.monitor, x0 + 0.3, 1.12, counterZ - 0.2, 0.03);
    box(0.08, 0.02, 0.08, M.metal, x0 + 0.42, 0.95, counterZ - 0.2, 0.01);
    waypoints.push(new Vector3(x0 + 0.95, 0, counterZ));
    // Big plant in the corner.
    cyl(0.18, 0.14, 0.4, M.pot, x0 + 0.4, 0.2, d / 2 - 0.45, 16);
    place(new SphereGeometry(0.32, 12, 10), M.plant, x0 + 0.4, 0.75, d / 2 - 0.45);
    place(new SphereGeometry(0.22, 12, 10), M.plantDark, x0 + 0.55, 1.05, d / 2 - 0.5);
    // Whiteboard on the back wall.
    const boardX = winXs[0] + (winXs[1] - winXs[0]) / 2;
    const board = place(new PlaneGeometry(1.2, 0.75), M.plan, boardX, 1.6, z0 + 0.012);
    void board;
    box(1.26, 0.05, 0.06, M.frame, boardX, 1.2, z0 + 0.03, 0.01);
    waypoints.push(new Vector3(boardX, 0, z0 + 0.75));

    if (level >= 2) {
      // Sofa corner.
      const sx = x0 + 1.5;
      const sz = d / 2 - 1.1;
      box(1.5, 0.5, 1.4, M.rug, sx + 0.1, 0.006, sz - 0.1, 0.004);
      box(1.2, 0.3, 0.55, M.sofa, sx, 0.25, sz, 0.08);
      box(1.2, 0.45, 0.16, M.sofaDark, sx, 0.52, sz + 0.24, 0.07);
      box(0.16, 0.38, 0.55, M.sofaDark, sx - 0.62, 0.35, sz, 0.06);
      box(0.16, 0.38, 0.55, M.sofaDark, sx + 0.62, 0.35, sz, 0.06);
      box(0.6, 0.04, 0.4, M.wood, sx, 0.36, sz - 0.65, 0.01);
      cyl(0.03, 0.03, 0.34, M.leg, sx, 0.17, sz - 0.65, 8);
      waypoints.push(new Vector3(sx + 0.2, 0, sz - 0.4));
      // Bookshelf.
      box(0.35, 1.8, 1.0, M.wood, x0 + 0.2, 0.9, counterZ + 1.3, 0.02);
      for (let i = 0; i < 4; i++) box(0.22, 0.26, 0.8, [M.accent, M.yellow, M.sofa, M.white][i], x0 + 0.24, 0.36 + i * 0.42, counterZ + 1.3, 0.02);
    }
    if (level >= 3) {
      // Big plants along the front, a ping-pong table for the culture slide deck.
      for (const px of [-w / 2 + 3, w / 2 - 0.5]) {
        cyl(0.2, 0.15, 0.45, M.pot, px, 0.22, d / 2 - 0.35, 16);
        place(new SphereGeometry(0.34, 12, 10), M.plant, px, 0.8, d / 2 - 0.35);
      }
      box(1.4, 0.05, 0.8, std('#2bb3a8', 0.6), x0 + 1.6, 0.76, z0 + 2.4, 0.01);
      box(0.02, 0.15, 0.8, M.white, x0 + 1.6, 0.86, z0 + 2.4, 0);
      for (const dx of [-0.6, 0.6]) box(0.05, 0.74, 0.7, M.leg, x0 + 1.6 + dx, 0.37, z0 + 2.4, 0.01);
    }
    if (level >= 4) {
      // Trophy shelf and a wall screen with the sales chart.
      box(2.4, 0.06, 0.3, M.wood, x0 + 2.4, 2.2, z0 + 0.18, 0.01);
      for (let i = 0; i < 5; i++) {
        cyl(0.05, 0.08, 0.06, M.yellow, x0 + 1.5 + i * 0.45, 2.26, z0 + 0.18, 10);
        place(new SphereGeometry(0.07, 10, 8), M.yellow, x0 + 1.5 + i * 0.45, 2.38, z0 + 0.18);
      }
    }

    // Research lab: bench with glowing samples (left wall, front part).
    if (lab > 0) {
      const lz = d / 2 - (level >= 2 ? 2.6 : 1.3);
      box(0.7, 0.9, 1.6, M.labBench, x0 + 0.4, 0.45, lz, 0.02);
      box(0.72, 0.04, 1.62, M.white, x0 + 0.4, 0.92, lz, 0.01);
      box(0.6, 0.9, 0.7, M.labBench, x0 + 0.35, 1.4, lz - 0.4, 0.03); // fume hood
      const flaskGroup = new Group();
      for (let i = 0; i < 2 + lab * 2; i++) {
        const f = new Mesh(new SphereGeometry(0.055, 12, 10), this.labGlow);
        f.position.set(x0 + 0.45 + (i % 2) * 0.12, 1.0, lz + 0.05 + Math.floor(i / 2) * 0.16);
        flaskGroup.add(f);
      }
      mergeInto(flaskGroup);
      this.statics.add(flaskGroup);
    }
    // Design studio: easel and mood board on the back wall.
    if (studio > 0) {
      const mx = winXs[winXs.length - 1] - 1.4;
      place(new PlaneGeometry(1.3, 0.8), M.mood, mx, 1.65, z0 + 0.012);
      box(1.36, 0.05, 0.06, M.frame, mx, 1.23, z0 + 0.03, 0.01);
      if (studio >= 2) {
        const ex = x0 + 2.2;
        const ez = z0 + 1.0;
        box(0.05, 1.5, 0.05, M.wood, ex - 0.3, 0.75, ez, 0.01);
        box(0.05, 1.5, 0.05, M.wood, ex + 0.3, 0.75, ez, 0.01);
        box(0.7, 0.5, 0.03, M.mood, ex, 1.15, ez + 0.03, 0.01);
      }
    }

    // Neon company sign above the pods.
    const sign = new Mesh(keep(new PlaneGeometry(2, 0.62)), this.signMat);
    sign.position.set(pods[Math.floor(pods.length / 2)].x - 0.6, 2.62, z0 + 0.02);
    this.statics.add(sign);

    batch.flush(this.statics);
    this.crowd.setWaypoints(waypoints);
  }

  update(t: number, dt: number): boolean {
    if (!this.root.visible) return false;
    const seated = this.crowd.seated();
    const c = new Color();
    this.staffBySeat.forEach((s, i) => {
      if (s && seated.has(s.id)) {
        c.set(ROLE_COLORS[s.role]).lerp(new Color('#ffffff'), 0.35);
        const flick = 1.5 + Math.sin(t * 3 + i * 1.7) * 0.12 + (this.busy ? 0.4 : 0);
        c.multiplyScalar(flick);
      } else if (s) c.set('#4a5060').multiplyScalar(0.6);
      else c.set('#111318');
      this.screens.setColorAt(i, c);
    });
    if (this.screens.instanceColor) this.screens.instanceColor.needsUpdate = true;
    this.signMat.color.setScalar((Math.sin(t * 37) > 0.995 ? 0.5 : 2.2) + Math.sin(t * 3) * 0.1);
    this.labGlow.emissiveIntensity = 1.8 + Math.sin(t * 2.2) * 0.5;
    return this.crowd.update(t, dt, this.busy);
  }

  /** World position above a team's desks (for HTML progress labels). */
  teamAnchor(role: Role, out: Vector3): boolean {
    if (!this.root.visible || !this.crowd.roleCentre(role, out)) return false;
    out.y += 1.75;
    return true;
  }

  dispose() {
    this.statics.traverse((o) => (o as Mesh).geometry?.dispose());
    this.disposables.forEach((d) => d.dispose());
    this.screens.geometry.dispose();
    this.screenMat.map?.dispose();
    this.screenMat.dispose();
    this.signMat.map?.dispose();
    this.signMat.dispose();
    this.labGlow.dispose();
    this.crowd.dispose();
  }
}

/** Merges a group's meshes (all sharing one material) into a single mesh. */
function mergeInto(group: Group) {
  const geos = group.children.map((c) => {
    const m = c as Mesh;
    m.updateMatrix();
    return m.geometry.clone().applyMatrix4(m.matrix);
  });
  const mat = (group.children[0] as Mesh).material as Material;
  group.children.forEach((c) => (c as Mesh).geometry.dispose());
  group.clear();
  group.add(new Mesh(mergeGeometries(geos, false), mat));
  geos.forEach((g) => g.dispose());
}
