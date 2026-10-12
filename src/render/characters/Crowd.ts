// Instanced staff figures: up to 24 people in five draw calls (torso, head, hair, arms,
// legs). Seated typing, idle sway and little walks to the coffee machine and back.

import {
  CapsuleGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { ROLE_COLORS, type Role } from '../../data/team';

export interface StaffVisual {
  id: number;
  role: Role;
  look: number;
  morale: number;
  /** In training: not at the desk. */
  away: boolean;
}

export interface SeatSpot {
  /** Chair position (floor level) in office-local coordinates. */
  pos: Vector3;
  /** Facing direction (unit vector on the floor). */
  dir: Vector3;
  /** Waypoints from the chair out to the front aisle. */
  exit: Vector3[];
}

const MAX = 24;
const SKIN = ['#f1c9a5', '#e0ac7e', '#c68b5b', '#9a6440', '#6b4428'].map((c) => new Color(c));
const HAIR = ['#2b1d16', '#4a3020', '#7a4b26', '#d8b26a', '#1a1a1f', '#b0443a', '#8d8d93'].map((c) => new Color(c));
const PANTS = ['#2b2f3f', '#3b4a63', '#4a3d34', '#22252e', '#5a5f6b'].map((c) => new Color(c));

type Mode = 'sit' | 'walk' | 'stand';

interface Person {
  v: StaffVisual;
  seat: SeatSpot;
  mode: Mode;
  pos: Vector3;
  yaw: number;
  path: Vector3[];
  returning: boolean;
  timer: number;
  phase: number;
  shirt: Color;
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const ONE = new Vector3(1, 1, 1);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** Geometry hanging down from its origin (pivot at the joint). */
function limb(radius: number, length: number): BufferGeometry {
  const g = new CapsuleGeometry(radius, length, 4, 10);
  g.translate(0, -length / 2 - radius * 0.5, 0);
  return g;
}

function yawOf(dir: Vector3): number {
  return Math.atan2(-dir.z, dir.x);
}

export class Crowd {
  readonly group = new Group();
  private torso: InstancedMesh;
  private head: InstancedMesh;
  private hair: InstancedMesh;
  private arms: InstancedMesh;
  private legs: InstancedMesh;
  private mats: MeshStandardMaterial[] = [];
  private people: Person[] = [];
  private waypoints: Vector3[] = [];
  private key = '';

  constructor() {
    const mat = (roughness: number) => {
      const m = new MeshStandardMaterial({ color: '#ffffff', roughness });
      this.mats.push(m);
      return m;
    };
    const inst = (geo: BufferGeometry, n: number, roughness: number) => {
      const m = new InstancedMesh(geo, mat(roughness), n);
      m.castShadow = true;
      m.count = 0;
      m.frustumCulled = false;
      for (let i = 0; i < n; i++) m.setColorAt(i, new Color('#ffffff'));
      this.group.add(m);
      return m;
    };
    const torsoGeo = new CapsuleGeometry(0.15, 0.24, 6, 12);
    torsoGeo.scale(1, 1, 0.82);
    this.torso = inst(torsoGeo, MAX, 0.8);
    this.head = inst(new SphereGeometry(0.125, 18, 12), MAX, 0.7);
    const hairGeo = new SphereGeometry(0.133, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    hairGeo.rotateZ(0.3);
    this.hair = inst(hairGeo, MAX, 0.9);
    this.arms = inst(limb(0.045, 0.34), MAX * 2, 0.8);
    this.legs = inst(limb(0.06, 0.38), MAX * 2, 0.85);
  }

  setWaypoints(points: Vector3[]) {
    this.waypoints = points;
  }

  /** Updates who is in the office. Keeps running animations for people who stay. */
  set(staff: StaffVisual[], seats: SeatSpot[]) {
    const key = staff.map((s) => `${s.id}:${s.away ? 1 : 0}`).join(',') + `|${seats.length}`;
    const old = new Map(this.people.map((p) => [p.v.id, p]));
    if (key === this.key) {
      // Only morale etc. changed.
      for (const p of this.people) p.v = staff.find((s) => s.id === p.v.id) ?? p.v;
      return;
    }
    this.key = key;
    this.people = [];
    staff.slice(0, Math.min(MAX, seats.length)).forEach((v, i) => {
      if (v.away) return;
      const seat = seats[i];
      const prev = old.get(v.id);
      const keep = prev && prev.seat.pos.equals(seat.pos);
      this.people.push(
        keep
          ? { ...prev, v, seat }
          : {
              v,
              seat,
              mode: 'sit',
              pos: seat.pos.clone(),
              yaw: yawOf(seat.dir),
              path: [],
              returning: false,
              timer: 8 + ((v.look * 7) % 40),
              phase: (v.look % 100) / 16,
              shirt: new Color(ROLE_COLORS[v.role]),
            },
      );
    });
    this.people.forEach((p, i) => {
      this.torso.setColorAt(i, p.shirt);
      this.arms.setColorAt(i * 2, p.shirt);
      this.arms.setColorAt(i * 2 + 1, p.shirt);
      this.head.setColorAt(i, SKIN[p.v.look % SKIN.length]);
      this.hair.setColorAt(i, HAIR[Math.floor(p.v.look / 7) % HAIR.length]);
      const pants = PANTS[Math.floor(p.v.look / 3) % PANTS.length];
      this.legs.setColorAt(i * 2, pants);
      this.legs.setColorAt(i * 2 + 1, pants);
    });
    for (const m of [this.torso, this.head, this.hair, this.arms, this.legs]) {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    const n = this.people.length;
    this.torso.count = this.head.count = this.hair.count = n;
    this.arms.count = this.legs.count = n * 2;
  }

  /** Who is sitting at a desk right now (for monitor glow). */
  seated(): Set<number> {
    return new Set(this.people.filter((p) => p.mode === 'sit').map((p) => p.v.id));
  }

  private startWalk(p: Person) {
    if (!this.waypoints.length) return;
    const target = this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
    const exit = p.seat.exit;
    const aisle = exit[exit.length - 1];
    p.path = [...exit.map((v) => v.clone()), new Vector3(target.x, 0, aisle.z), target.clone()];
    p.returning = false;
    p.mode = 'walk';
  }

  update(t: number, dt: number, busy: boolean): boolean {
    let animating = false;
    this.people.forEach((p, i) => {
      // Behaviour.
      p.timer -= dt;
      if (p.mode === 'sit' && p.timer <= 0) {
        // Busy teams take fewer breaks; unhappy people take more.
        const breakChance = busy ? 0.25 : 0.6;
        if (Math.random() < breakChance + (p.v.morale < 40 ? 0.3 : 0)) this.startWalk(p);
        p.timer = 15 + Math.random() * 35;
      } else if (p.mode === 'walk') {
        animating = true;
        const next = p.path[0];
        if (next) {
          tmpV.subVectors(next, p.pos);
          tmpV.y = 0;
          const d = tmpV.length();
          const step = dt * 0.95;
          if (d <= step) {
            p.pos.copy(next);
            p.path.shift();
          } else {
            tmpV.multiplyScalar(1 / d);
            p.pos.addScaledVector(tmpV, step);
            const want = yawOf(tmpV);
            let dy = want - p.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            p.yaw += dy * Math.min(1, dt * 10);
          }
        } else if (!p.returning) {
          p.mode = 'stand';
          p.timer = 3 + Math.random() * 4;
        } else {
          p.mode = 'sit';
          p.pos.copy(p.seat.pos);
          p.yaw = yawOf(p.seat.dir);
          p.timer = 20 + Math.random() * 40;
        }
      } else if (p.mode === 'stand' && p.timer <= 0) {
        const exit = p.seat.exit;
        const aisle = exit[exit.length - 1];
        p.path = [new Vector3(p.pos.x, 0, aisle.z), ...[...exit].reverse().map((v) => v.clone()), p.seat.pos.clone()];
        p.returning = true;
        p.mode = 'walk';
      }
      this.pose(p, i, t);
    });
    for (const m of [this.torso, this.head, this.hair, this.arms, this.legs]) m.instanceMatrix.needsUpdate = true;
    return animating || this.people.length > 0;
  }

  private pose(p: Person, i: number, t: number) {
    const base = new Matrix4().compose(p.pos, tmpQ.setFromAxisAngle(Y, p.yaw), ONE);
    const local = (x: number, y: number, z: number, rz = 0, rx = 0) => {
      const q = new Quaternion().setFromAxisAngle(Z, rz);
      if (rx) q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx));
      return tmpM.compose(new Vector3(x, y, z), q, ONE).premultiply(base);
    };
    const ph = p.phase;
    const sad = p.v.morale < 40;
    let hip: number;
    let lean = 0;
    let armA: [number, number];
    let legA: [number, number];
    let headTilt = 0;
    let headTurn = 0;
    if (p.mode === 'sit') {
      hip = 0.5;
      const speed = sad ? 9 : 18;
      armA = [1.15 + Math.sin(t * speed + ph) * 0.05, 1.15 + Math.sin(t * speed + ph + 1.7) * 0.05];
      legA = [1.35, 1.35];
      lean = 0.08;
      headTilt = sad ? -0.25 : -0.08 + Math.sin(t * 0.9 + ph) * 0.04;
      headTurn = Math.sin(t * 0.3 + ph) > 0.93 ? 0.6 : 0;
    } else if (p.mode === 'walk') {
      const s = Math.sin(t * 8 + ph);
      hip = 0.82 + Math.abs(Math.cos(t * 8 + ph)) * 0.03;
      armA = [s * 0.5, -s * 0.5];
      legA = [-s * 0.55, s * 0.55];
    } else {
      hip = 0.82;
      // Standing at the cooler: one arm up with a cup now and then.
      armA = [Math.sin(t * 0.8 + ph) > 0.3 ? 1.9 : 0.1, 0.08];
      legA = [0, 0];
      headTurn = Math.sin(t * 0.7 + ph) * 0.4;
    }
    this.torso.setMatrixAt(i, local(0, hip + 0.26, 0, -lean));
    const headY = hip + 0.6;
    const hm = local(lean * 0.6, headY, 0, headTilt);
    if (headTurn) hm.multiply(new Matrix4().makeRotationY(headTurn));
    this.head.setMatrixAt(i, hm);
    this.hair.setMatrixAt(i, hm.clone().multiply(new Matrix4().makeTranslation(-0.01, 0.012, 0)));
    for (const side of [0, 1]) {
      const z = side ? 0.19 : -0.19;
      this.arms.setMatrixAt(i * 2 + side, local(lean * 0.4, hip + 0.47, z, armA[side]));
      this.legs.setMatrixAt(i * 2 + side, local(0, hip, side ? 0.09 : -0.09, legA[side]));
    }
  }

  /** World-space centre of everyone with the given role (for labels). */
  roleCentre(role: Role, out: Vector3): boolean {
    const list = this.people.filter((p) => p.v.role === role);
    if (!list.length) return false;
    out.set(0, 0, 0);
    for (const p of list) out.add(p.seat.pos);
    out.multiplyScalar(1 / list.length);
    this.group.localToWorld(out);
    return true;
  }

  dispose() {
    for (const m of [this.torso, this.head, this.hair, this.arms, this.legs]) {
      m.geometry.dispose();
      m.dispose();
    }
    this.mats.forEach((m) => m.dispose());
  }
}
