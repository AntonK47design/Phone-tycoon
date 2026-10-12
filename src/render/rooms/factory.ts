// Factory diorama (M4): conveyor lines with instanced phones, robot arms, an inspection
// gate with a scrap chute, and a warehouse whose crates fill up with stock.

import {
  BoxGeometry,
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
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { concreteTexture, skyTexture } from '../textures';
import { StaticBatcher } from './batch';

export const FACTORY_ORIGIN = new Vector3(-14, 0, 0);

export interface FactoryLineVisual {
  level: number;
  /** Colour of the phone being built (null = idle line). */
  colorHex: string | null;
  running: boolean;
  /** Scrap share (0–1) – drives how often the gate flashes red. */
  scrap: number;
}

export interface FactoryVisual {
  size: number;
  lines: FactoryLineVisual[];
  /** Belt speed multiplier from the tempo setting. */
  speed: number;
  /** Warehouse fill 0–1 (above 1 = overflow). */
  fill: number;
  warehouse: number;
}

const MAX_LINES = 8;
const PHONES_PER_LINE = 14;
const ROBOTS_PER_LINE = 4;
const MAX_CRATES = 96;

export function factoryLayout(size: number): { w: number; d: number } {
  return [
    { w: 10, d: 6.5 },
    { w: 12, d: 9 },
    { w: 15, d: 14 },
  ][Math.max(0, Math.min(2, size - 1))];
}

export class Factory {
  readonly root = new Group();
  private statics = new Group();
  private disposables: { dispose(): void }[] = [];
  private phones: InstancedMesh;
  private robotParts: InstancedMesh[];
  private lights: InstancedMesh;
  private crates: InstancedMesh;
  private mats: Material[] = [];
  private visual: FactoryVisual | null = null;
  private key = '';
  private shown = false;
  /** Per-line belt geometry in local coordinates. */
  private belts: { x0: number; x1: number; z: number; gateX: number }[] = [];
  private crateSlots: Matrix4[] = [];
  private offsets = new Float32Array(MAX_LINES);
  private flash = new Float32Array(MAX_LINES);
  private rejectAt = new Float32Array(MAX_LINES).fill(-1);

  constructor() {
    this.root.position.copy(FACTORY_ORIGIN);
    this.root.add(this.statics);
    const mat = (color: string, roughness = 0.5, metalness = 0) => {
      const m = new MeshStandardMaterial({ color, roughness, metalness });
      this.mats.push(m);
      return m;
    };
    const inst = (geo: BufferGeometry, m: Material, n: number, cast = true) => {
      const im = new InstancedMesh(geo, m, n);
      im.count = 0;
      im.castShadow = cast;
      im.frustumCulled = false;
      this.root.add(im);
      return im;
    };
    this.phones = inst(new RoundedBoxGeometry(0.17, 0.025, 0.32, 2, 0.012), mat('#ffffff', 0.25, 0.1), MAX_LINES * PHONES_PER_LINE);
    for (let i = 0; i < MAX_LINES * PHONES_PER_LINE; i++) this.phones.setColorAt(i, new Color('#fff'));
    const orange = mat('#ff7a1a', 0.45, 0.2);
    const steel = mat('#c6ccd4', 0.3, 0.8);
    const dark = mat('#2b2f3a', 0.5, 0.4);
    const base = new CylinderGeometry(0.16, 0.2, 0.25, 16);
    base.translate(0, 0.125, 0);
    const arm1 = new BoxGeometry(0.1, 0.55, 0.1);
    arm1.translate(0, 0.275, 0);
    const arm2 = new BoxGeometry(0.08, 0.45, 0.08);
    arm2.translate(0, 0.225, 0);
    const head = new CylinderGeometry(0.07, 0.05, 0.12, 12);
    head.translate(0, -0.06, 0);
    this.robotParts = [inst(base, dark, MAX_LINES * ROBOTS_PER_LINE), inst(arm1, orange, MAX_LINES * ROBOTS_PER_LINE), inst(arm2, orange, MAX_LINES * ROBOTS_PER_LINE), inst(head, steel, MAX_LINES * ROBOTS_PER_LINE)];
    const lightMat = new MeshBasicMaterial({ color: '#ffffff' });
    this.mats.push(lightMat);
    this.lights = inst(new SphereGeometry(0.06, 10, 8), lightMat, MAX_LINES, false);
    for (let i = 0; i < MAX_LINES; i++) this.lights.setColorAt(i, new Color('#3cff8a'));
    this.crates = inst(new BoxGeometry(0.42, 0.32, 0.42), mat('#c89a63', 0.9), MAX_CRATES);
    this.root.visible = false;
  }

  setShown(on: boolean) {
    this.shown = on;
    this.root.visible = on && (this.visual?.size ?? 0) > 0;
  }

  setVisual(v: FactoryVisual) {
    this.visual = v;
    this.root.visible = this.shown && v.size > 0;
    if (v.size < 1) return;
    const key = `${v.size}|${v.lines.length}`;
    if (key !== this.key) {
      this.key = key;
      this.build(v.size, v.lines.length);
    }
    v.lines.forEach((l, i) => {
      const c = new Color(l.colorHex ?? '#d8d8d8');
      for (let k = 0; k < PHONES_PER_LINE; k++) this.phones.setColorAt(i * PHONES_PER_LINE + k, c);
    });
    if (this.phones.instanceColor) this.phones.instanceColor.needsUpdate = true;
    // Warehouse crates.
    const n = Math.round(Math.min(1, v.fill) * this.crateSlots.length);
    this.crateSlots.slice(0, n).forEach((m, i) => this.crates.setMatrixAt(i, m));
    this.crates.count = n;
    this.crates.instanceMatrix.needsUpdate = true;
  }

  private build(size: number, lineCount: number) {
    this.statics.traverse((o) => (o as Mesh).geometry?.dispose());
    this.statics.clear();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    const keep = <T extends { dispose(): void }>(x: T) => (this.disposables.push(x), x);
    const std = (color: string, roughness = 0.7, metalness = 0, extra: Partial<MeshStandardMaterial> = {}) =>
      keep(new MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.45, ...extra }));
    const batch = new StaticBatcher();
    const tmp = new Group();
    const place = (geo: BufferGeometry, m: Material, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) => {
      const mesh = new Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.set(...rot);
      tmp.add(mesh);
      batch.add(mesh);
      tmp.remove(mesh);
      geo.dispose();
    };
    const box = (w: number, h: number, d: number, m: Material, x: number, y: number, z: number, r = 0.02, rot?: [number, number, number]) =>
      place(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new BoxGeometry(w, h, d), m, x, y, z, rot);

    const M = {
      slab: std('#2a2e44', 0.9),
      slabTop: std('#3a3f5c', 0.8),
      floor: std('#ffffff', 0.85, 0, { map: keep(concreteTexture()) }),
      wall: std('#c9ced6', 0.85),
      wallLeft: std('#b9bfc8', 0.85),
      stripe: std('#ffd23f', 0.6),
      frame: std('#3a3f4a', 0.45, 0.5),
      belt: std('#1d1f26', 0.8),
      feeder: std('#4f7cff', 0.5, 0.2),
      gate: std('#e8ecef', 0.4, 0.3),
      chute: std('#9aa1aa', 0.35, 0.7),
      bin: std('#e5383b', 0.6),
      rack: std('#2bb3a8', 0.5, 0.3),
      cap: std('#f2f2f2', 0.6),
    };
    const { w, d } = factoryLayout(size);
    const x0 = -w / 2;
    const z0 = -d / 2;
    const wallH = 3.6;
    const wallT = 0.2;
    box(w + 0.4, 0.42, d + 0.4, M.slab, 0, -0.23, 0, 0.06);
    box(w + 0.44, 0.05, d + 0.44, M.slabTop, 0, -0.03, 0, 0.02);
    const floor = new Mesh(keep(new PlaneGeometry(w, d)), M.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.receiveShadow = true;
    this.statics.add(floor);
    // Back wall with a strip of high windows, left wall, safety stripes.
    box(w + wallT, 1.9, wallT, M.wall, -wallT / 2, 0.95, z0 - wallT / 2, 0);
    box(w + wallT, 0.7, wallT, M.wall, -wallT / 2, wallH - 0.35, z0 - wallT / 2, 0);
    const sky = keep(new MeshBasicMaterial({ map: keep(skyTexture()) }));
    const skyPlane = new Mesh(keep(new PlaneGeometry(w, 1)), sky);
    skyPlane.position.set(0, 2.4, z0 - 0.5);
    this.statics.add(skyPlane);
    for (let x = x0 + 1.5; x < w / 2; x += 2.5) box(0.08, 1.0, wallT + 0.04, M.frame, x, 2.4, z0 - wallT / 2, 0.01);
    box(wallT, wallH, d, M.wallLeft, x0 - wallT / 2, wallH / 2, 0, 0);
    box(w, 0.05, wallT + 0.02, M.cap, 0, wallH + 0.02, z0 - wallT / 2, 0);

    // Warehouse racks on the left.
    const whW = 2.6;
    const rackX = x0 + 0.35;
    this.crateSlots = [];
    const rackRows = Math.max(2, Math.floor((d - 1) / 1.1));
    for (let r = 0; r < rackRows; r++) {
      const rz = z0 + 0.8 + r * 1.1;
      for (const lvl of [0.02, 0.72, 1.42]) box(0.6, 0.05, 0.9, M.rack, rackX, lvl, rz, 0.01);
      for (const dz of [-0.42, 0.42]) box(0.05, 1.9, 0.05, M.rack, rackX, 0.95, rz + dz, 0.01);
      for (const lvl of [0.22, 0.92, 1.62]) {
        for (const dz of [-0.22, 0.22]) {
          this.crateSlots.push(new Matrix4().makeTranslation(rackX, lvl, rz + dz));
        }
      }
    }
    // Floor stacks in front of the racks.
    for (let r = 0; r < rackRows && this.crateSlots.length < MAX_CRATES; r++) {
      for (let s = 0; s < 3 && this.crateSlots.length < MAX_CRATES; s++) {
        this.crateSlots.push(new Matrix4().makeTranslation(x0 + 1.2 + (s % 2) * 0.48, 0.17 + Math.floor(s / 2) * 0.33, z0 + 0.8 + r * 1.1));
      }
    }
    this.crateSlots = this.crateSlots.slice(0, MAX_CRATES);
    box(0.08, 0.01, d - 0.4, M.stripe, x0 + whW - 0.6, 0.006, 0, 0);

    // Lines along x, stacked in z.
    this.belts = [];
    const lx0 = x0 + whW + 0.3;
    const lx1 = w / 2 - 0.6;
    const spacing = Math.min(1.5, (d - 1.6) / Math.max(1, lineCount));
    for (let i = 0; i < lineCount; i++) {
      const z = z0 + 1.1 + i * spacing + (lineCount === 1 ? (d - 2.2) / 4 : 0);
      const len = lx1 - lx0;
      const cx = (lx0 + lx1) / 2;
      box(len, 0.08, 0.5, M.frame, cx, 0.62, z, 0.01);
      box(len - 0.04, 0.03, 0.42, M.belt, cx, 0.675, z, 0.005);
      for (let k = 0; k <= Math.floor(len / 1.4); k++) {
        box(0.06, 0.62, 0.06, M.frame, lx0 + 0.1 + k * 1.4, 0.31, z - 0.2, 0.01);
        box(0.06, 0.62, 0.06, M.frame, lx0 + 0.1 + k * 1.4, 0.31, z + 0.2, 0.01);
      }
      // Feeder at the right end, inspection gate near the left end, scrap chute + bin.
      box(0.7, 1.0, 0.7, M.feeder, lx1 + 0.15, 0.5, z, 0.04);
      const gateX = lx0 + 0.9;
      box(0.08, 0.7, 0.08, M.gate, gateX, 1.0, z - 0.3, 0.01);
      box(0.08, 0.7, 0.08, M.gate, gateX, 1.0, z + 0.3, 0.01);
      box(0.12, 0.1, 0.7, M.gate, gateX, 1.35, z, 0.02);
      box(0.5, 0.04, 0.3, M.chute, gateX - 0.3, 0.42, z + 0.42, 0.01, [0.5, 0, 0]);
      box(0.4, 0.3, 0.3, M.bin, gateX - 0.3, 0.15, z + 0.62, 0.03);
      this.belts.push({ x0: lx0, x1: lx1, z, gateX });
    }
    batch.flush(this.statics);
  }

  update(t: number, dt: number): boolean {
    const v = this.visual;
    if (!this.root.visible || !v) return false;
    const m = new Matrix4();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const p = new Vector3();
    let phones = 0;
    let robots = 0;
    v.lines.forEach((line, i) => {
      const belt = this.belts[i];
      if (!belt) return;
      const len = belt.x1 - belt.x0;
      const speed = line.running && line.colorHex ? (0.25 + 0.05 * line.level) * v.speed : 0;
      this.offsets[i] = (this.offsets[i] + dt * speed) % 1;
      // Phones travel from the feeder (right) to the warehouse end (left).
      if (line.colorHex) {
        for (let k = 0; k < PHONES_PER_LINE; k++) {
          const u = (k / PHONES_PER_LINE + this.offsets[i]) % 1;
          const x = belt.x1 - u * len;
          let y = 0.705;
          let z = belt.z;
          let tilt = 0;
          // The flagged phone leaves the belt after the gate and slides into the bin.
          const rejected = this.rejectAt[i] === k && x < belt.gateX;
          if (rejected) {
            const s = Math.min(1, (belt.gateX - x) / 0.5);
            z += s * 0.55;
            y -= s * 0.5;
            tilt = s * 0.6;
          }
          q.setFromAxisAngle(new Vector3(1, 0, 0), tilt);
          this.phones.setMatrixAt(phones++, m.compose(p.set(x, y, z), q, one));
        }
        // New reject roughly in proportion to the scrap rate (exaggerated so it's visible).
        if (speed > 0 && this.rejectAt[i] < 0 && Math.random() < line.scrap * dt * 8) {
          this.rejectAt[i] = Math.floor(((1 - this.offsets[i]) % 1) * PHONES_PER_LINE) % PHONES_PER_LINE;
          this.flash[i] = 1;
        } else if (this.rejectAt[i] >= 0 && Math.random() < dt * 0.5) this.rejectAt[i] = -1;
      }
      this.flash[i] = Math.max(0, this.flash[i] - dt * 1.5);
      this.lights.setMatrixAt(i, m.compose(p.set(belt.gateX, 1.45, belt.z), q.identity(), one));
      this.lights.setColorAt(i, new Color(this.flash[i] > 0.05 ? '#ff3b3b' : line.running && line.colorHex ? '#3cff8a' : '#888').multiplyScalar(this.flash[i] > 0.05 ? 3 : 2));
      // Robot arms: more with higher line levels.
      const count = Math.min(ROBOTS_PER_LINE, 1 + Math.floor(line.level / 3));
      for (let r = 0; r < count; r++) {
        const side = r % 2 ? 1 : -1;
        const rx = belt.x0 + 1.6 + ((r + 0.5) / count) * (len - 1.8);
        const rz = belt.z + side * 0.55;
        const ph = t * (speed > 0 ? 3 + line.level * 0.3 : 0.4) + r * 1.3 + i;
        const yaw = Math.sin(ph) * 0.6;
        const reach = 0.7 + Math.sin(ph * 2) * 0.2;
        const baseM = new Matrix4().compose(p.set(rx, 0, rz), q.setFromAxisAngle(new Vector3(0, 1, 0), yaw + (side > 0 ? Math.PI : 0)), one);
        this.robotParts[0].setMatrixAt(robots, baseM);
        const a1 = baseM.clone().multiply(new Matrix4().makeTranslation(0, 0.25, 0)).multiply(new Matrix4().makeRotationX(-reach * 0.6));
        this.robotParts[1].setMatrixAt(robots, a1);
        const a2 = a1.clone().multiply(new Matrix4().makeTranslation(0, 0.55, 0)).multiply(new Matrix4().makeRotationX(-reach * 1.2));
        this.robotParts[2].setMatrixAt(robots, a2);
        const hd = a2.clone().multiply(new Matrix4().makeTranslation(0, 0.45, 0)).multiply(new Matrix4().makeRotationX(reach * 1.8 - 0.3));
        this.robotParts[3].setMatrixAt(robots, hd);
        robots++;
      }
    });
    this.phones.count = phones;
    this.phones.instanceMatrix.needsUpdate = true;
    for (const part of this.robotParts) {
      part.count = robots;
      part.instanceMatrix.needsUpdate = true;
    }
    this.lights.count = v.lines.length;
    this.lights.instanceMatrix.needsUpdate = true;
    if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    return v.lines.some((l) => l.running && l.colorHex);
  }

  dispose() {
    this.statics.traverse((o) => (o as Mesh).geometry?.dispose());
    this.disposables.forEach((d) => d.dispose());
    for (const im of [this.phones, ...this.robotParts, this.lights, this.crates]) {
      im.geometry.dispose();
      im.dispose();
    }
    this.mats.forEach((m) => m.dispose());
  }
}
