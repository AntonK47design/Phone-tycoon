// Instanced staff figures: up to 24 people in five draw calls (torso, head, hair, arms,
// legs). Seated typing, idle sway and little walks to the coffee machine and back.

import {
  BufferAttribute,
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

/**
 * Merges parts into one geometry with a grey vertex colour per part. The instance colour
 * multiplies it: white parts take the person's colour (shirt, skin …), dark parts stay dark
 * (eyes, belt, shoes). Many details, one draw call per body part for the whole crowd.
 */
export function parts(list: [BufferGeometry, number][]): BufferGeometry {
  const geos = list.map(([g, grey]) => {
    let x = g.index ? g.toNonIndexed() : g;
    if (x !== g) g.dispose();
    x.deleteAttribute('uv');
    const n = x.attributes.position.count;
    const c = new Float32Array(n * 3).fill(grey);
    x.setAttribute('color', new BufferAttribute(c, 3));
    return x;
  });
  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return merged;
}
export const at = <T extends BufferGeometry>(g: T, x: number, y: number, z: number): T => g.translate(x, y, z) as T;

function yawOf(dir: Vector3): number {
  return Math.atan2(-dir.z, dir.x);
}

export class Crowd {
  readonly group = new Group();
  private torso: InstancedMesh;
  private head: InstancedMesh;
  private hair: InstancedMesh;
  private hairLong: InstancedMesh;
  private arms: InstancedMesh;
  private hands: InstancedMesh;
  private legs: InstancedMesh;
  /** Index of each person in the short / long hair mesh (−1 = other style). */
  private hairSlot: [number, number][] = [];
  private mats: MeshStandardMaterial[] = [];
  private people: Person[] = [];
  private waypoints: Vector3[] = [];
  private key = '';

  constructor() {
    const mat = (roughness: number) => {
      const m = new MeshStandardMaterial({ color: '#ffffff', roughness, vertexColors: true });
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
    // Torso: shirt, collar, belt with buckle, a few buttons.
    const torsoCore = new CapsuleGeometry(0.15, 0.24, 6, 14);
    torsoCore.scale(1, 1, 0.82);
    const collar = new TorusGeometry(0.07, 0.022, 8, 18).rotateX(Math.PI / 2);
    const belt = new CylinderGeometry(0.152, 0.152, 0.045, 18).scale(1, 1, 0.82);
    this.torso = inst(
      parts([
        [torsoCore, 1],
        [at(collar, 0, 0.255, 0), 0.82],
        [at(belt, 0, -0.17, 0), 0.22],
        [at(new BoxGeometry(0.02, 0.035, 0.05), -0.125, -0.17, 0), 0.9],
        [at(new SphereGeometry(0.011, 6, 4), -0.135, 0.12, 0), 0.6],
        [at(new SphereGeometry(0.011, 6, 4), -0.142, 0.03, 0), 0.6],
      ]),
      MAX,
      0.8,
    );
    // Head (faces −x): face, ears, nose, eyes, brows, mouth – all tinted with the skin colour.
    const headParts: [BufferGeometry, number][] = [[new SphereGeometry(0.125, 18, 12), 1]];
    for (const side of [-1, 1]) {
      headParts.push([at(new SphereGeometry(0.028, 8, 6).scale(0.8, 1, 0.5), 0, 0, side * 0.124), 0.95]);
      headParts.push([at(new SphereGeometry(0.014, 8, 6).scale(0.6, 1.2, 1), -0.118, 0.02, side * 0.045), 0.08]);
      headParts.push([at(new BoxGeometry(0.01, 0.011, 0.04).rotateX(side * -0.15), -0.118, 0.06, side * 0.047), 0.3]);
    }
    headParts.push([at(new SphereGeometry(0.018, 8, 6), -0.13, -0.012, 0), 0.97]);
    headParts.push([at(new TorusGeometry(0.026, 0.006, 6, 10, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI), -0.116, -0.04, 0), 0.5]);
    this.head = inst(parts(headParts), MAX, 0.7);
    // Two hairstyles: short with a fringe, and long with a fall at the back and a bun.
    const cap = () => new SphereGeometry(0.133, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55).rotateZ(0.3);
    this.hair = inst(parts([[cap(), 1], [at(new SphereGeometry(0.06, 10, 8).scale(0.7, 0.45, 1.4), -0.085, 0.095, 0.02), 1]]), MAX, 0.9);
    this.hairLong = inst(
      parts([
        [cap(), 1],
        [at(new CapsuleGeometry(0.1, 0.12, 4, 12).scale(0.55, 1, 1.2), 0.07, -0.06, 0), 1],
        [at(new SphereGeometry(0.055, 10, 8), 0.1, 0.11, 0), 0.92],
      ]),
      MAX,
      0.9,
    );
    // Arms: sleeve with a cuff; hands are their own (skin-tinted) mesh.
    const armLen = 0.34;
    this.arms = inst(parts([[limb(0.048, armLen - 0.08), 1], [at(new CylinderGeometry(0.05, 0.05, 0.035, 10), 0, -(armLen - 0.08) - 0.02, 0), 0.8]]), MAX * 2, 0.8);
    this.hands = inst(at(new SphereGeometry(0.042, 10, 8).scale(0.8, 1.1, 1), 0, -armLen - 0.01, 0), MAX * 2, 0.7);
    // Legs: trousers ending in a shoe with a light sole.
    const legLen = 0.38;
    this.legs = inst(
      parts([
        [limb(0.06, legLen), 1],
        [at(new CapsuleGeometry(0.05, 0.1, 4, 8).rotateZ(Math.PI / 2), -0.04, -legLen - 0.06, 0), 0.12],
        [at(new BoxGeometry(0.17, 0.02, 0.09), -0.045, -legLen - 0.105, 0), 0.85],
      ]),
      MAX * 2,
      0.85,
    );
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
      const skin = SKIN[p.v.look % SKIN.length];
      this.head.setColorAt(i, skin);
      this.hands.setColorAt(i * 2, skin);
      this.hands.setColorAt(i * 2 + 1, skin);
      const pants = PANTS[Math.floor(p.v.look / 3) % PANTS.length];
      this.legs.setColorAt(i * 2, pants);
      this.legs.setColorAt(i * 2 + 1, pants);
    });
    // Hairstyle from the look: about half short, half long.
    let short = 0;
    let long = 0;
    this.hairSlot = this.people.map((p) => {
      const col = HAIR[Math.floor(p.v.look / 7) % HAIR.length];
      if ((p.v.look >> 2) % 2 === 0) {
        this.hair.setColorAt(short, col);
        return [short++, -1];
      }
      this.hairLong.setColorAt(long, col);
      return [-1, long++];
    });
    for (const m of this.meshes()) {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    const n = this.people.length;
    this.torso.count = this.head.count = n;
    this.hair.count = short;
    this.hairLong.count = long;
    this.arms.count = this.legs.count = this.hands.count = n * 2;
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
    for (const m of this.meshes()) m.instanceMatrix.needsUpdate = true;
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
    const hairM = hm.clone().multiply(new Matrix4().makeTranslation(-0.01, 0.012, 0));
    const [hs, hl] = this.hairSlot[i] ?? [-1, -1];
    if (hs >= 0) this.hair.setMatrixAt(hs, hairM);
    if (hl >= 0) this.hairLong.setMatrixAt(hl, hairM);
    for (const side of [0, 1]) {
      const z = side ? 0.19 : -0.19;
      const armM = local(lean * 0.4, hip + 0.47, z, armA[side]);
      this.arms.setMatrixAt(i * 2 + side, armM);
      this.hands.setMatrixAt(i * 2 + side, armM);
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

  private meshes(): InstancedMesh[] {
    return [this.torso, this.head, this.hair, this.hairLong, this.arms, this.hands, this.legs];
  }

  dispose() {
    for (const m of this.meshes()) {
      m.geometry.dispose();
      m.dispose();
    }
    this.mats.forEach((m) => m.dispose());
  }
}
