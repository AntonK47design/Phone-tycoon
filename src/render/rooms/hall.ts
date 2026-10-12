// Hall of Fame (M6): a dark showroom with glass cases. Each case holds the phone behind a
// record, in its colour, slowly turning under a spotlight.

import {
  BoxGeometry,
  CircleGeometry,
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
  Vector3,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { StaticBatcher } from './batch';
import { neonTexture } from './officeCorner';

export const HALL_ORIGIN = new Vector3(0, 0, 16);

export interface HallVisual {
  /** Phone colours of the records (up to 6). */
  colors: (string | null)[];
  companyName: string;
}

const CASES = 6;
const W = 9;
const D = 6;

export class Hall {
  readonly root = new Group();
  private statics = new Group();
  private phones: InstancedMesh;
  private spots: InstancedMesh;
  private disposables: { dispose(): void }[] = [];
  private visual: HallVisual | null = null;
  private signMat = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  private signText = '';
  private slots: Vector3[] = [];

  constructor() {
    this.root.position.copy(HALL_ORIGIN);
    this.root.add(this.statics);
    const keep = <T extends { dispose(): void }>(x: T) => (this.disposables.push(x), x);
    const std = (color: string, roughness = 0.5, metalness = 0) => keep(new MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.6 }));
    const M = {
      slab: std('#1c1e2c', 0.9),
      floor: std('#2a2c3a', 0.25, 0.2),
      wall: std('#23253a', 0.9),
      pedestal: std('#efe9dd', 0.35),
      gold: std('#d8b26a', 0.3, 0.9),
    };
    const glass = keep(new MeshPhysicalMaterial({ color: '#dff0ff', roughness: 0.02, transparent: true, opacity: 0.16, depthWrite: false }));
    const batch = new StaticBatcher();
    const tmp = new Group();
    const add = (mesh: Mesh) => {
      tmp.add(mesh);
      batch.add(mesh);
      tmp.remove(mesh);
      mesh.geometry.dispose();
    };
    const box = (w: number, h: number, d: number, m: Material, x: number, y: number, z: number, r = 0.02) => {
      const mesh = new Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m);
      mesh.position.set(x, y, z);
      add(mesh);
    };
    box(W + 0.4, 0.42, D + 0.4, M.slab, 0, -0.23, 0, 0.06);
    box(W, 0.04, D, M.floor, 0, 0, 0, 0.01);
    box(W + 0.2, 3.4, 0.2, M.wall, -0.1, 1.7, -D / 2 - 0.1, 0);
    box(0.2, 3.4, D, M.wall, -W / 2 - 0.1, 1.7, 0, 0);
    // Pedestals in an arc, with a gold rim.
    for (let i = 0; i < CASES; i++) {
      const a = -0.9 + (i / (CASES - 1)) * 1.8;
      const x = Math.sin(a) * 3.2;
      const z = -Math.cos(a) * 1.6 + 0.6;
      const ped = new Mesh(new CylinderGeometry(0.42, 0.48, 0.9, 24), M.pedestal);
      ped.position.set(x, 0.45, z);
      add(ped);
      const rim = new Mesh(new CylinderGeometry(0.44, 0.44, 0.04, 24), M.gold);
      rim.position.set(x, 0.91, z);
      add(rim);
      this.slots.push(new Vector3(x, 1.24, z));
    }
    batch.flush(this.statics);
    // Glass cases (transparent, not batched).
    const caseGeo = keep(new BoxGeometry(0.72, 0.9, 0.72));
    for (const p of this.slots) {
      const c = new Mesh(caseGeo, glass);
      c.position.set(p.x, 1.38, p.z);
      this.statics.add(c);
    }
    this.phones = new InstancedMesh(keep(new RoundedBoxGeometry(0.26, 0.52, 0.035, 2, 0.02)), keep(new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, clearcoat: 1 })), CASES);
    this.phones.castShadow = true;
    this.phones.frustumCulled = false;
    this.root.add(this.phones);
    // Spotlight pools on the floor.
    const spotMat = keep(new MeshBasicMaterial({ color: '#ffe9b0', transparent: true, opacity: 0.35, depthWrite: false }));
    this.spots = new InstancedMesh(keep(new CircleGeometry(0.75, 32)), spotMat, CASES);
    const m = new Matrix4();
    this.slots.forEach((p, i) => this.spots.setMatrixAt(i, m.compose(new Vector3(p.x, 0.03, p.z + 0.15), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2), new Vector3(1, 1, 1))));
    this.spots.frustumCulled = false;
    this.root.add(this.spots);
    this.signMat.color.setScalar(2.2);
    const sign = new Mesh(keep(new PlaneGeometry(3.2, 0.95)), this.signMat);
    sign.position.set(0, 2.6, -D / 2 + 0.02);
    this.statics.add(sign);
    this.root.visible = false;
  }

  setShown(on: boolean) {
    this.root.visible = on;
  }

  setVisual(v: HallVisual) {
    this.visual = v;
    const label = `${v.companyName} · Hall of Fame`;
    if (label !== this.signText) {
      this.signText = label;
      this.signMat.map?.dispose();
      this.signMat.map = neonTexture(v.companyName);
      this.signMat.needsUpdate = true;
    }
    for (let i = 0; i < CASES; i++) this.phones.setColorAt(i, new Color(v.colors[i] ?? '#3a3c4a'));
    if (this.phones.instanceColor) this.phones.instanceColor.needsUpdate = true;
  }

  update(t: number): boolean {
    if (!this.root.visible || !this.visual) return false;
    const m = new Matrix4();
    const q = new Quaternion();
    const n = Math.min(CASES, Math.max(1, this.visual.colors.length));
    for (let i = 0; i < CASES; i++) {
      const p = this.slots[i];
      const filled = i < n;
      q.setFromAxisAngle(new Vector3(0, 1, 0), t * 0.5 + i);
      this.phones.setMatrixAt(i, m.compose(new Vector3(p.x, p.y + Math.sin(t * 1.4 + i) * 0.02, p.z), q, new Vector3(1, 1, 1).multiplyScalar(filled ? 1 : 0.001)));
    }
    this.phones.instanceMatrix.needsUpdate = true;
    return true;
  }

  dispose() {
    this.statics.traverse((o) => (o as Mesh).geometry?.dispose());
    this.disposables.forEach((d) => d.dispose());
    this.signMat.map?.dispose();
    this.signMat.dispose();
  }
}
