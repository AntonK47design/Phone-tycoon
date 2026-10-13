// Garage diorama (Phase 1). Cut-away room built from procedural geometry.

import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  SpotLight,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Cat } from '../characters/Cat';
import { Founder } from '../characters/Founder';
import { PhoneModel } from '../phone/PhoneModel';
import {
  concreteTexture,
  laptopScreenTexture,
  pegboardTexture,
  posterTexture,
  rugTexture,
  skyTexture,
  whiteboardTexture,
  woodTexture,
} from '../textures';
import { StaticBatcher } from './batch';

export const ROOM = { w: 7, d: 6, wallH: 3, wallT: 0.18 };
export const TURNTABLE_POS = new Vector3(1.35, 0, 0.75);

export interface GarageRoom {
  root: Group;
  /** Rotating plate; the hero phone is parented to `heroAnchor`. */
  heroAnchor: Group;
  ledMaterial: MeshStandardMaterial;
  spot: SpotLight;
  founder: Founder;
  /** World position above the workbench (for progress labels). */
  benchLabelPos: Vector3;
  update(t: number, dt: number, dayFraction: number, launchBoost: number): void;
  dispose(): void;
}

export function buildGarage(quality: 'low' | 'medium' | 'high'): GarageRoom {
  const root = new Group();
  root.name = 'garage';
  const batch = new StaticBatcher();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const std = (color: string, roughness = 0.7, metalness = 0, extra: Partial<MeshStandardMaterial> = {}) =>
    keep(new MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.45, ...extra }));

  const M = {
    floor: std('#b3aca2', 0.82, 0, { map: keep(concreteTexture()) }),
    slab: std('#2a2e44', 0.9),
    slabTop: std('#3a3f5c', 0.8),
    wallBack: std('#d9c6ad', 0.92),
    wallLeft: std('#cbb79d', 0.92),
    wallCap: std('#f7f0e6', 0.7),
    trim: std('#f4efe8', 0.6),
    wood: std('#ffffff', 0.55, 0, { map: keep(woodTexture()) }),
    woodDark: std('#ffffff', 0.6, 0, { map: keep(woodTexture('#7a5232')) }),
    metalDark: std('#3a3f4a', 0.45, 0.6),
    metalLight: std('#b8bec7', 0.3, 0.85),
    door: std('#8ea4b8', 0.5, 0.35),
    doorRidge: std('#7f95aa', 0.5, 0.35),
    cardboard: std('#c89a63', 0.92),
    tape: std('#e9dcb6', 0.7),
    red: std('#d8453b', 0.45, 0.1),
    yellow: std('#f2c14e', 0.5),
    teal: std('#2bb3a8', 0.5),
    plant: std('#3f9a5b', 0.75),
    plantDark: std('#2e7a46', 0.75),
    pot: std('#c96f4a', 0.8),
    peg: std('#ffffff', 0.85, 0, { map: keep(pegboardTexture()) }),
    rug: std('#ffffff', 0.95, 0, { map: keep(rugTexture()) }),
    fabric: std('#e2874a', 0.95),
    black: std('#1b1d24', 0.5),
    white: std('#f2f2f2', 0.5),
    poster: std('#ffffff', 0.7, 0, { map: keep(posterTexture()) }),
    board: std('#d8d8d4', 0.6, 0, { map: keep(whiteboardTexture()) }),
    frame: std('#f2f2f2', 0.4, 0.1),
    windowFrame: std('#f5f5f0', 0.5),
    cable: std('#22252e', 0.6),
  };
  const sky = keep(new MeshBasicMaterial({ map: keep(skyTexture()) }));
  const glass = keep(
    new MeshPhysicalMaterial({ color: '#cfe6ff', roughness: 0.05, transparent: true, opacity: 0.18, envMapIntensity: 1 }),
  );

  const place = (geo: BufferGeometry, mat: Material, x: number, y: number, z: number, rot?: [number, number, number], opts?: { castShadow?: boolean }) => {
    keep(geo);
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    root.add(mesh);
    batch.add(mesh, opts);
    root.remove(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, r = 0.02, rot?: [number, number, number]) =>
    place(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new BoxGeometry(w, h, d), mat, x, y, z, rot);
  const cyl = (rt: number, rb: number, h: number, mat: Material, x: number, y: number, z: number, seg = 24, rot?: [number, number, number]) =>
    place(new CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rot);

  const { w, d, wallH, wallT } = ROOM;
  const x0 = -w / 2;
  const z0 = -d / 2;

  // ── Base slab & floor ────────────────────────────────────────────────
  box(w + 0.4, 0.42, d + 0.4, M.slab, 0, -0.23, 0, 0.06);
  box(w + 0.44, 0.05, d + 0.44, M.slabTop, 0, -0.03, 0, 0.02);
  const floorGeo = keep(new PlaneGeometry(w, d));
  const floor = new Mesh(floorGeo, M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = true;
  root.add(floor);

  // ── Walls (back wall has a window opening) ───────────────────────────
  const winX0 = -2.55;
  const winX1 = -1.25;
  const winY0 = 1.25;
  const winY1 = 2.35;
  const bz = z0 - wallT / 2;
  const backSeg = (xa: number, xb: number, ya: number, yb: number) =>
    box(xb - xa, yb - ya, wallT, M.wallBack, (xa + xb) / 2, (ya + yb) / 2, bz, 0);
  backSeg(x0 - wallT, winX0, 0, wallH);
  backSeg(winX1, w / 2, 0, wallH);
  backSeg(winX0, winX1, 0, winY0);
  backSeg(winX0, winX1, winY1, wallH);
  box(w + wallT, 0.04, wallT + 0.02, M.wallCap, -wallT / 2, wallH + 0.02, bz, 0);
  // Left wall.
  const lx = x0 - wallT / 2;
  box(wallT, wallH, d, M.wallLeft, lx, wallH / 2, 0, 0);
  box(wallT + 0.02, 0.04, d, M.wallCap, lx, wallH + 0.02, 0, 0);
  // Baseboards.
  box(w, 0.09, 0.03, M.trim, 0, 0.045, z0 + 0.015, 0);
  box(0.03, 0.09, d, M.trim, x0 + 0.015, 0.045, 0, 0);

  // Window: frame, glass, outside sky.
  const wcx = (winX0 + winX1) / 2;
  const wcy = (winY0 + winY1) / 2;
  const fw = 0.06;
  box(winX1 - winX0 + fw, fw, wallT + 0.04, M.windowFrame, wcx, winY0, bz, 0.01);
  box(winX1 - winX0 + fw, fw, wallT + 0.04, M.windowFrame, wcx, winY1, bz, 0.01);
  box(fw, winY1 - winY0, wallT + 0.04, M.windowFrame, winX0, wcy, bz, 0.01);
  box(fw, winY1 - winY0, wallT + 0.04, M.windowFrame, winX1, wcy, bz, 0.01);
  box(0.035, winY1 - winY0, 0.05, M.windowFrame, wcx, wcy, bz, 0.01);
  box(winX1 - winX0, 0.035, 0.05, M.windowFrame, wcx, wcy, bz, 0.01);
  box(winX1 - winX0 + 0.2, 0.05, 0.22, M.windowFrame, wcx, winY0 - 0.02, z0 + 0.08, 0.015);
  const skyPlane = new Mesh(keep(new PlaneGeometry(2.2, 1.6)), sky);
  skyPlane.position.set(wcx, wcy, z0 - 0.6);
  root.add(skyPlane);
  const pane = new Mesh(keep(new PlaneGeometry(winX1 - winX0, winY1 - winY0)), glass);
  pane.position.set(wcx, wcy, bz);
  root.add(pane);
  // Small plant on the sill.
  cyl(0.07, 0.055, 0.12, M.pot, wcx - 0.35, winY0 + 0.07, z0 + 0.1, 16);
  place(new SphereGeometry(0.1, 12, 10), M.plant, wcx - 0.35, winY0 + 0.2, z0 + 0.1);

  // ── Garage door (right part of the back wall) ────────────────────────
  const doorX0 = 0.75;
  const doorX1 = 3.25;
  const doorH = 2.45;
  box(doorX1 - doorX0, doorH, 0.06, M.door, (doorX0 + doorX1) / 2, doorH / 2, z0 + 0.03, 0.01);
  for (let i = 1; i < 8; i++) {
    box(doorX1 - doorX0 - 0.06, 0.035, 0.03, M.doorRidge, (doorX0 + doorX1) / 2, (doorH / 8) * i, z0 + 0.07, 0.01);
  }
  box(0.4, 0.05, 0.05, M.metalLight, (doorX0 + doorX1) / 2, 0.5, z0 + 0.1, 0.02);
  box(0.1, doorH + 0.1, 0.12, M.trim, doorX0 - 0.05, doorH / 2, z0 + 0.06, 0.01);
  box(0.1, doorH + 0.1, 0.12, M.trim, doorX1 + 0.05, doorH / 2, z0 + 0.06, 0.01);
  box(doorX1 - doorX0 + 0.2, 0.1, 0.12, M.trim, (doorX0 + doorX1) / 2, doorH + 0.05, z0 + 0.06, 0.01);

  // ── Workbench along the left wall ────────────────────────────────────
  const benchX = x0 + 0.42;
  const benchZ0 = -2.65;
  const benchZ1 = -0.35;
  const benchH = 0.92;
  const benchZc = (benchZ0 + benchZ1) / 2;
  const benchLen = benchZ1 - benchZ0;
  box(0.8, 0.06, benchLen, M.wood, benchX, benchH - 0.03, benchZc, 0.015);
  for (const zz of [benchZ0 + 0.06, benchZ1 - 0.06]) {
    for (const xx of [benchX - 0.34, benchX + 0.34]) box(0.05, benchH - 0.06, 0.05, M.metalDark, xx, (benchH - 0.06) / 2, zz, 0.01);
  }
  box(0.72, 0.04, benchLen - 0.1, M.woodDark, benchX, 0.22, benchZc, 0.01);
  // Drawer cabinet.
  box(0.7, 0.6, 0.55, M.red, benchX, 0.55, benchZ0 + 0.4, 0.02);
  for (let i = 0; i < 3; i++) box(0.02, 0.025, 0.25, M.metalLight, benchX + 0.36, 0.38 + i * 0.18, benchZ0 + 0.4, 0.008);
  // Boxes under the bench.
  box(0.4, 0.3, 0.45, M.cardboard, benchX, 0.39, benchZ1 - 0.45, 0.01);
  box(0.41, 0.02, 0.06, M.tape, benchX, 0.545, benchZ1 - 0.45, 0.005);

  // Pegboard with tools.
  const pegZc = (benchZ0 + benchZ1) / 2;
  const peg = place(new PlaneGeometry(benchLen - 0.1, 1.0), M.peg, x0 + 0.005, 1.65, pegZc, [0, Math.PI / 2, 0]);
  void peg;
  const tool = (mat: Material, zz: number, y: number, h: number, wdt = 0.04) => box(0.03, h, wdt, mat, x0 + 0.03, y, zz, 0.01);
  tool(M.metalLight, pegZc - 0.8, 1.7, 0.36, 0.05);
  tool(M.red, pegZc - 0.62, 1.68, 0.3, 0.06);
  tool(M.yellow, pegZc - 0.45, 1.72, 0.26, 0.05);
  tool(M.metalDark, pegZc - 0.2, 1.6, 0.4, 0.035);
  tool(M.teal, pegZc + 0.05, 1.75, 0.22, 0.07);
  place(new TorusGeometry(0.08, 0.03, 10, 20), M.yellow, x0 + 0.06, 1.85, pegZc + 0.35, [0, Math.PI / 2, 0]);
  for (let i = 0; i < 5; i++) tool([M.red, M.teal, M.yellow, M.metalDark, M.metalLight][i], pegZc + 0.6 + i * 0.07, 1.45, 0.18, 0.025);

  // Laptop.
  const lapX = benchX - 0.05;
  const lapZ = -1.55;
  box(0.26, 0.02, 0.36, M.metalLight, lapX, benchH + 0.01, lapZ, 0.008);
  box(0.02, 0.24, 0.36, M.metalLight, lapX - 0.14, benchH + 0.13, lapZ, 0.008, [0, 0, -0.22]);
  const lap = laptopScreenTexture();
  keep(lap.texture);
  const lapScreenMat = keep(new MeshBasicMaterial({ map: lap.texture }));
  lapScreenMat.color.setScalar(1.4);
  const lapScreen = new Mesh(keep(new PlaneGeometry(0.33, 0.21)), lapScreenMat);
  lapScreen.position.set(lapX - 0.128, benchH + 0.13, lapZ);
  lapScreen.rotation.set(0, Math.PI / 2, 0);
  lapScreen.rotateX(0.22);
  root.add(lapScreen);
  // Mug, lamp, small parts.
  cyl(0.045, 0.04, 0.1, M.white, benchX + 0.15, benchH + 0.05, -2.0, 18);
  place(new TorusGeometry(0.03, 0.01, 8, 14), M.white, benchX + 0.15, benchH + 0.05, -1.95, [0, 0, 0]);
  cyl(0.08, 0.1, 0.03, M.metalDark, benchX - 0.15, benchH + 0.015, -2.35, 20);
  box(0.03, 0.42, 0.03, M.metalDark, benchX - 0.15, benchH + 0.22, -2.35, 0.01, [0, 0, 0.35]);
  box(0.03, 0.32, 0.03, M.metalDark, benchX - 0.02, benchH + 0.48, -2.35, 0.01, [0, 0, -0.9]);
  const shade = place(new CylinderGeometry(0.05, 0.11, 0.12, 20, 1, true), M.teal, benchX + 0.13, benchH + 0.48, -2.35, [0, 0, -2.2]);
  void shade;
  const bulbMat = keep(new MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd89a', emissiveIntensity: 4 }));
  const bulb = new Mesh(keep(new SphereGeometry(0.035, 12, 10)), bulbMat);
  bulb.position.set(benchX + 0.17, benchH + 0.44, -2.35);
  root.add(bulb);
  const parts = ['#ff6b6b', '#4dc3ff', '#ffe066', '#6bd66b'];
  parts.forEach((c, i) => box(0.05, 0.02, 0.05, std(c, 0.5), benchX + 0.1 + (i % 2) * 0.07, benchH + 0.01, -0.85 - Math.floor(i / 2) * 0.07, 0.008));
  // Soldering station.
  box(0.16, 0.08, 0.12, M.yellow, benchX - 0.2, benchH + 0.04, -0.75, 0.015);
  cyl(0.008, 0.008, 0.22, M.metalDark, benchX - 0.1, benchH + 0.12, -0.75, 8, [0.4, 0, 0.6]);

  // Prototype phones lying on the bench.
  const proto1 = new PhoneModel({ colorHex: '#c3c7cd', shapeId: 'boxy', displaySize: 3.0, kitYear: 2007, finishId: 'matte', lenses: 1 }, { detail: 'prop' });
  proto1.group.rotation.set(-Math.PI / 2, 0, 0.4);
  proto1.group.scale.setScalar(0.45);
  proto1.group.position.set(benchX + 0.12, benchH + 0.012, -1.15);
  root.add(proto1.group);
  const proto2 = new PhoneModel({ colorHex: null, shapeId: 'round', displaySize: 3.5, kitYear: 2007, finishId: 'gloss', lenses: 1 }, { detail: 'prop' });
  proto2.group.rotation.set(Math.PI / 2, 0, -0.3);
  proto2.group.scale.setScalar(0.45);
  proto2.group.position.set(benchX + 0.2, benchH + 0.012, -0.6);
  root.add(proto2.group);
  disposables.push(proto1, proto2);
  // Props never move: merge them into the static batch.
  for (const proto of [proto1, proto2]) {
    proto.group.updateMatrixWorld(true);
    proto.group.traverse((o) => {
      if ((o as Mesh).isMesh) batch.add(o as Mesh);
    });
    root.remove(proto.group);
  }

  // Stool.
  const founderPos = new Vector3(benchX + 0.85, 0, lapZ);
  cyl(0.2, 0.2, 0.06, M.black, founderPos.x, 0.68, founderPos.z, 24);
  cyl(0.025, 0.025, 0.66, M.metalLight, founderPos.x, 0.34, founderPos.z, 10);
  place(new TorusGeometry(0.17, 0.015, 8, 24), M.metalLight, founderPos.x, 0.25, founderPos.z, [Math.PI / 2, 0, 0]);
  cyl(0.24, 0.26, 0.03, M.metalDark, founderPos.x, 0.015, founderPos.z, 24);

  const founder = new Founder();
  founder.root.position.copy(founderPos);
  founder.root.position.x += 0.05;
  root.add(founder.root);
  disposables.push(founder);

  // ── Shelf unit (front of the left wall) ──────────────────────────────
  const shelfX = x0 + 0.27;
  const shelfZ = 1.55;
  for (const zz of [shelfZ - 0.6, shelfZ + 0.6]) box(0.45, 2.0, 0.04, M.metalDark, shelfX, 1.0, zz, 0.01);
  for (let i = 0; i < 4; i++) box(0.45, 0.03, 1.24, M.woodDark, shelfX, 0.25 + i * 0.55, shelfZ, 0.01);
  const boxColors = [M.cardboard, M.cardboard, M.teal, M.cardboard, M.red, M.cardboard];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      if ((i + j) % 4 === 3) continue;
      const h = 0.18 + ((i * 7 + j * 3) % 5) * 0.04;
      box(0.34, h, 0.3, boxColors[(i + j) % boxColors.length], shelfX, 0.265 + i * 0.55 + h / 2, shelfZ - 0.38 + j * 0.38, 0.015);
    }
  }
  // Paint cans.
  cyl(0.08, 0.08, 0.16, M.white, shelfX, 0.36, shelfZ + 0.4, 18);
  cyl(0.08, 0.08, 0.16, M.yellow, shelfX + 0.05, 0.91, shelfZ + 0.42, 18);

  // ── Whiteboard on easel ──────────────────────────────────────────────
  const wbX = -0.35;
  const wbZ = -2.35;
  const wbRot: [number, number, number] = [-0.12, 0.25, 0];
  const wbGroup = new Group();
  wbGroup.position.set(wbX, 0, wbZ);
  wbGroup.rotation.set(0, 0.25, 0);
  root.add(wbGroup);
  const wb = new Mesh(keep(new PlaneGeometry(1.2, 0.8)), M.board);
  wb.position.set(0, 1.45, 0.04);
  wb.rotation.x = wbRot[0];
  wbGroup.add(wb);
  const wbFrame = new Mesh(keep(new RoundedBoxGeometry(1.28, 0.88, 0.04, 2, 0.015)), M.frame);
  wbFrame.position.set(0, 1.45, 0.0);
  wbFrame.rotation.x = wbRot[0];
  wbGroup.add(wbFrame);
  for (const sx of [-0.5, 0.5]) {
    const leg = new Mesh(keep(new BoxGeometry(0.04, 1.9, 0.04)), M.woodDark);
    leg.position.set(sx, 0.95, 0.1);
    leg.rotation.x = -0.12;
    wbGroup.add(leg);
  }
  const backLeg = new Mesh(keep(new BoxGeometry(0.04, 1.8, 0.04)), M.woodDark);
  backLeg.position.set(0, 0.9, -0.25);
  backLeg.rotation.x = 0.25;
  wbGroup.add(backLeg);
  wbGroup.updateMatrixWorld(true);
  for (const c of [...wbGroup.children]) batch.add(c as Mesh);
  root.remove(wbGroup);

  // Wall clock (hands animated with game time).
  const clockPos = new Vector3(0.05, 2.62, z0 + 0.03);
  cyl(0.2, 0.2, 0.04, M.white, clockPos.x, clockPos.y, clockPos.z, 32, [Math.PI / 2, 0, 0]);
  place(new TorusGeometry(0.2, 0.02, 8, 32), M.black, clockPos.x, clockPos.y, clockPos.z + 0.02);
  const handMat = M.black;
  const hourHand = new Mesh(keep(new BoxGeometry(0.02, 0.1, 0.01)), handMat);
  hourHand.geometry.translate(0, 0.05, 0);
  hourHand.position.set(clockPos.x, clockPos.y, clockPos.z + 0.03);
  const minHand = new Mesh(keep(new BoxGeometry(0.012, 0.16, 0.01)), handMat);
  minHand.geometry.translate(0, 0.08, 0);
  minHand.position.set(clockPos.x, clockPos.y, clockPos.z + 0.035);
  root.add(hourHand, minHand);

  // Poster on the left wall.
  place(new PlaneGeometry(0.6, 0.85), M.poster, x0 + 0.01, 2.3, 0.35, [0, Math.PI / 2, 0]);

  // Stack of shipping boxes by the door (future product!).
  const stack: [number, number, number, number][] = [
    [2.75, 0.2, -2.45, 0.1],
    [2.3, 0.2, -2.5, -0.15],
    [2.55, 0.6, -2.48, 0.05],
    [2.85, 0.2, -1.95, 0.4],
  ];
  for (const [bx, by, bzz, rot] of stack) {
    box(0.42, 0.4, 0.42, M.cardboard, bx, by, bzz, 0.015, [0, rot, 0]);
    box(0.43, 0.02, 0.08, M.tape, bx, by + 0.205, bzz, 0.005, [0, rot, 0]);
  }
  // Toolbox.
  box(0.5, 0.24, 0.24, M.red, 0.35, 0.12, -2.6, 0.03);
  box(0.24, 0.04, 0.04, M.black, 0.35, 0.28, -2.6, 0.015);

  // Beanbag & big plant (front-left corner).
  const beanGeo = keep(new SphereGeometry(0.42, 24, 18));
  beanGeo.scale(1, 0.62, 1);
  place(beanGeo, M.fabric, -2.35, 0.26, 2.15);
  const cat = new Cat();
  cat.root.position.set(-2.38, 0.5, 2.1);
  cat.root.rotation.y = 0.9;
  root.add(cat.root);
  disposables.push(cat);
  cyl(0.2, 0.15, 0.36, M.pot, -3.05, 0.18, 2.6, 20);
  const leaves: [number, number, number, number][] = [
    [0, 0.65, 0, 0.22],
    [0.12, 0.85, 0.05, 0.18],
    [-0.1, 0.9, -0.05, 0.2],
    [0.05, 1.1, -0.08, 0.16],
    [-0.12, 0.62, 0.12, 0.16],
  ];
  leaves.forEach(([lx2, ly, lz, r], i) => place(new SphereGeometry(r, 14, 12), i % 2 ? M.plant : M.plantDark, -3.05 + lx2, ly, 2.6 + lz));

  // Rug under the showcase.
  const rug = new Mesh(keep(new CircleGeometry(1.15, 48)), M.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(TURNTABLE_POS.x, 0.006, TURNTABLE_POS.z);
  rug.receiveShadow = true;
  root.add(rug);

  // ── Turntable (hero showcase) ────────────────────────────────────────
  const tt = TURNTABLE_POS;
  const profile = [
    new Vector2(0, 0),
    new Vector2(0.7, 0),
    new Vector2(0.72, 0.02),
    new Vector2(0.72, 0.1),
    new Vector2(0.66, 0.16),
    new Vector2(0.6, 0.17),
    new Vector2(0, 0.17),
  ];
  const ttBaseMat = keep(new MeshPhysicalMaterial({ color: '#1d2030', roughness: 0.35, metalness: 0.3, clearcoat: 0.6, envMapIntensity: 0.8 }));
  const ttBase = new Mesh(keep(new LatheGeometry(profile, 64)), ttBaseMat);
  ttBase.position.copy(tt);
  ttBase.castShadow = ttBase.receiveShadow = true;
  root.add(ttBase);
  const plateMat = keep(new MeshPhysicalMaterial({ color: '#0f1118', roughness: 0.12, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1 }));
  const plate = new Mesh(keep(new CylinderGeometry(0.58, 0.6, 0.04, 64)), plateMat);
  plate.position.set(tt.x, 0.19, tt.z);
  plate.receiveShadow = true;
  root.add(plate);
  const ledMaterial = keep(new MeshStandardMaterial({ color: '#000000', emissive: '#58d6ff', emissiveIntensity: 3.5 }));
  const led = new Mesh(keep(new TorusGeometry(0.61, 0.012, 8, 96)), ledMaterial);
  led.rotation.x = Math.PI / 2;
  led.position.set(tt.x, 0.19, tt.z);
  batch.add(led, { castShadow: false });
  const led2 = new Mesh(keep(new TorusGeometry(0.715, 0.008, 8, 96)), ledMaterial);
  led2.rotation.x = Math.PI / 2;
  led2.position.set(tt.x, 0.02, tt.z);
  // Both rings share one glowing material: merged into one draw call.
  batch.add(led2, { castShadow: false });
  const heroAnchor = new Group();
  heroAnchor.position.set(tt.x, 0.21, tt.z);
  root.add(heroAnchor);

  // Pendant lamp above the turntable.
  const lampY = 2.75;
  const cableCurve = new CatmullRomCurve3([new Vector3(tt.x, 3.6, tt.z), new Vector3(tt.x, lampY + 0.1, tt.z)]);
  place(new TubeGeometry(cableCurve, 2, 0.008, 6), M.cable, 0, 0, 0, undefined, { castShadow: false });
  const pendant = new Mesh(keep(new CylinderGeometry(0.05, 0.22, 0.2, 32, 1, true)), keep(new MeshStandardMaterial({ color: '#20232e', roughness: 0.4, metalness: 0.6, side: DoubleSide })));
  pendant.position.set(tt.x, lampY, tt.z);
  root.add(pendant);
  const pendantBulb = new Mesh(keep(new SphereGeometry(0.05, 12, 10)), bulbMat);
  pendantBulb.position.set(tt.x, lampY - 0.08, tt.z);
  root.add(pendantBulb);

  const spot = new SpotLight('#fff1dc', 2.6, 6, 0.42, 0.65, 1.6);
  spot.position.set(tt.x, lampY - 0.1, tt.z);
  spot.target.position.set(tt.x, 0.3, tt.z);
  spot.castShadow = quality === 'high';
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.radius = 4;
  root.add(spot, spot.target);

  // Showroom key light from the front, so the hero phone's face reads well.
  const heroKey = new SpotLight('#fff6ea', 1.5, 6, 0.32, 0.8, 1.4);
  heroKey.position.set(tt.x + 1.1, 1.9, tt.z + 2.0);
  heroKey.target.position.set(tt.x, 0.55, tt.z);
  root.add(heroKey, heroKey.target);

  // Desk lamp light (no shadow, warm pool on the bench).
  const deskLight = new PointLight('#ffcf8f', 1.6, 2.6, 1.6);
  deskLight.position.set(benchX + 0.2, benchH + 0.38, -2.3);
  root.add(deskLight);

  // ── String lights along the walls (instanced) ────────────────────────
  const bulbsPts: Vector3[] = [];
  const sag = (a: Vector3, b: Vector3, n: number, depth: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(Math.PI * t) * depth;
      bulbsPts.push(p);
    }
  };
  const yTop = wallH - 0.12;
  sag(new Vector3(x0 + 0.05, yTop, z0 + 0.08), new Vector3(0.6, yTop, z0 + 0.08), 13, 0.18);
  sag(new Vector3(0.6, yTop, z0 + 0.08), new Vector3(w / 2 - 0.1, yTop, z0 + 0.08), 11, 0.15);
  sag(new Vector3(x0 + 0.08, yTop, z0 + 0.1), new Vector3(x0 + 0.08, yTop, 0.6), 14, 0.18);
  sag(new Vector3(x0 + 0.08, yTop, 0.6), new Vector3(x0 + 0.08, yTop, d / 2 - 0.15), 10, 0.14);
  const wireCurve = new CatmullRomCurve3(bulbsPts.slice(0, 24));
  place(new TubeGeometry(wireCurve, 80, 0.006, 4), M.cable, 0, 0, 0, undefined, { castShadow: false });
  const wireCurve2 = new CatmullRomCurve3(bulbsPts.slice(24));
  place(new TubeGeometry(wireCurve2, 80, 0.006, 4), M.cable, 0, 0, 0, undefined, { castShadow: false });
  const fairyMat = keep(new MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveIntensity: 4 }));
  const fairy = new InstancedMesh(keep(new SphereGeometry(0.03, 10, 8)), fairyMat, bulbsPts.length);
  const dummy = new Object3D();
  const warm = new Color('#ffc46b');
  bulbsPts.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.position.y -= 0.035;
    dummy.updateMatrix();
    fairy.setMatrixAt(i, dummy.matrix);
    fairy.setColorAt(i, warm);
  });
  root.add(fairy);

  // ── Little life details (all static, merged into the batches) ────────
  // Mini fridge with magnets and a couple of cans, between bench and shelf.
  const fz = 0.3;
  const fx = x0 + 0.33;
  box(0.5, 0.82, 0.52, M.white, fx, 0.41, fz, 0.04);
  box(0.02, 0.6, 0.03, M.metalDark, fx + 0.26, 0.48, fz + 0.18, 0.01);
  for (const [mx, my, col] of [[0.1, 0.62, '#ff6b6b'], [-0.08, 0.5, '#4dc3ff'], [0.05, 0.36, '#ffe066']] as const) {
    box(0.02, 0.06, 0.06, std(col, 0.5), fx + 0.255, my, fz + mx, 0.01);
  }
  for (let i = 0; i < 2; i++) cyl(0.033, 0.033, 0.12, i ? M.yellow : std('#e5383b', 0.4, 0.3), fx - 0.05 + i * 0.1, 0.88, fz - 0.1, 14);
  // Dartboard above it.
  cyl(0.24, 0.24, 0.04, M.black, x0 + 0.03, 1.75, fz, 28, [0, 0, Math.PI / 2]);
  cyl(0.2, 0.2, 0.045, std('#f2e6c8', 0.7), x0 + 0.035, 1.75, fz, 28, [0, 0, Math.PI / 2]);
  cyl(0.13, 0.13, 0.05, std('#e5383b', 0.7), x0 + 0.04, 1.75, fz, 24, [0, 0, Math.PI / 2]);
  cyl(0.06, 0.06, 0.055, std('#1fbf86', 0.7), x0 + 0.045, 1.75, fz, 20, [0, 0, Math.PI / 2]);
  cyl(0.02, 0.02, 0.06, M.black, x0 + 0.05, 1.75, fz, 12, [0, 0, Math.PI / 2]);
  for (const [dy, dz] of [[0.04, 0.05], [-0.07, -0.02]]) cyl(0.006, 0.004, 0.12, M.yellow, x0 + 0.1, 1.75 + dy, fz + dz, 6, [0, 0, Math.PI / 2]);
  // Pizza boxes and a soda can in the front-right corner, a skateboard on the floor.
  const pzX = 2.75;
  const pzZ = 2.45;
  for (let i = 0; i < 4; i++) box(0.46, 0.05, 0.46, i === 3 ? std('#f2e2c4', 0.85) : std('#d9b98a', 0.85), pzX + (i % 2) * 0.03, 0.025 + i * 0.052, pzZ - (i % 2) * 0.02, 0.008);
  box(0.2, 0.012, 0.05, std('#e5383b', 0.7), pzX, 0.215, pzZ, 0.004);
  cyl(0.033, 0.033, 0.12, std('#4f7cff', 0.4, 0.3), pzX + 0.36, 0.06, pzZ - 0.1, 14);
  const skX = 0.15;
  const skZ = 2.55;
  box(0.78, 0.025, 0.2, std('#ff5a1f', 0.6), skX, 0.085, skZ, 0.05, [0, 0.35, 0]);
  for (const sx of [-0.25, 0.25]) {
    const ox = Math.cos(0.35) * sx;
    const oz = -Math.sin(0.35) * sx;
    box(0.05, 0.03, 0.16, M.metalDark, skX + ox, 0.06, skZ + oz, 0.01, [0, 0.35, 0]);
    for (const w2 of [-0.07, 0.07]) cyl(0.03, 0.03, 0.03, std('#f4f4f4', 0.5), skX + ox + Math.sin(0.35) * w2, 0.03, skZ + oz + Math.cos(0.35) * w2, 12, [Math.PI / 2, 0.35, 0]);
  }

  batch.flush(root);

  const fairyColor = new Color();
  const fairyPalette = [new Color('#ffc46b'), new Color('#ff8fb1'), new Color('#7fdcff'), new Color('#b6ff8f')];
  return {
    root,
    heroAnchor,
    ledMaterial,
    spot,
    founder,
    benchLabelPos: new Vector3(benchX + 0.1, 1.25, benchZ1 - 0.3),
    update(t, dt, dayFraction, launchBoost) {
      founder.update(t, dt);
      cat.update(t);
      // Clock: one full revolution of the hour hand per game day.
      hourHand.rotation.z = -dayFraction * Math.PI * 4;
      minHand.rotation.z = -dayFraction * Math.PI * 48;
      // Twinkle; party colors during launch.
      for (let i = 0; i < bulbsPts.length; i++) {
        const tw = 0.75 + 0.25 * Math.sin(t * 2.2 + i * 1.7);
        if (launchBoost > 0.01) {
          fairyColor.copy(fairyPalette[(i + Math.floor(t * 6)) % fairyPalette.length]).multiplyScalar(0.6 + launchBoost);
        } else {
          fairyColor.copy(warm).multiplyScalar(tw);
        }
        fairy.setColorAt(i, fairyColor);
      }
      fairy.instanceColor!.needsUpdate = true;
      ledMaterial.emissiveIntensity = 3.2 + Math.sin(t * 2) * 0.4 + launchBoost * 5;
      spot.intensity = 2.6 + launchBoost * 10;
    },
    dispose() {
      batch.dispose();
      disposables.forEach((x) => x.dispose());
      root.traverse((o) => (o as Mesh).geometry?.dispose());
    },
  };
}
