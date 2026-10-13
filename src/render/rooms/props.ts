// Reusable static props for the dioramas (lamps, plants, pallets, a forklift …).
// Rooms pass a small "kit" that adds primitives to their StaticBatcher, so plain-coloured
// props merge into the room's shared batches and cost (almost) no extra draw calls.

import type { Material } from 'three';

export interface Kit {
  box(w: number, h: number, d: number, m: Material, x: number, y: number, z: number, r?: number): void;
  cyl(rt: number, rb: number, h: number, m: Material, x: number, y: number, z: number, seg?: number): void;
  sphere(r: number, m: Material, x: number, y: number, z: number): void;
}

/** Industrial / office pendant: cable from `topY`, shade and a glowing bulb at `y`. */
export function pendantLamp(k: Kit, m: { cable: Material; shade: Material; bulb: Material }, x: number, z: number, topY: number, y: number, wide = 0.3) {
  k.cyl(0.008, 0.008, topY - y, m.cable, x, (topY + y) / 2 + 0.08, z, 6);
  k.cyl(0.05, wide, 0.18, m.shade, x, y, z, 20);
  k.sphere(0.06, m.bulb, x, y - 0.08, z);
}

/** Potted plant; `s` scales the whole thing. */
export function plant(k: Kit, m: { pot: Material; leaf: Material; leafDark: Material }, x: number, z: number, s = 1) {
  k.cyl(0.17 * s, 0.13 * s, 0.38 * s, m.pot, x, 0.19 * s, z, 16);
  k.cyl(0.175 * s, 0.175 * s, 0.03 * s, m.pot, x, 0.38 * s, z, 16);
  k.sphere(0.3 * s, m.leaf, x, 0.7 * s, z);
  k.sphere(0.2 * s, m.leafDark, x + 0.14 * s, 0.95 * s, z - 0.05 * s);
  k.sphere(0.16 * s, m.leaf, x - 0.12 * s, 1.0 * s, z + 0.08 * s);
}

/** Wooden pallet with a stack of cardboard boxes (`layers` 0–3). */
export function pallet(k: Kit, m: { wood: Material; box: Material; tape: Material }, x: number, z: number, layers: number) {
  for (const dz of [-0.3, 0, 0.3]) k.box(0.8, 0.07, 0.12, m.wood, x, 0.035, z + dz, 0.005);
  k.box(0.8, 0.03, 0.8, m.wood, x, 0.085, z, 0.005);
  for (let l = 0; l < layers; l++) {
    for (const [dx, dz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
      const y = 0.1 + 0.17 + l * 0.34;
      k.box(0.37, 0.33, 0.37, m.box, x + dx, y, z + dz, 0.015);
      k.box(0.372, 0.04, 0.08, m.tape, x + dx, y + 0.15, z + dz, 0.005);
    }
  }
}

/** Parked forklift, forks pointing to −x. */
export function forklift(k: Kit, m: { body: Material; dark: Material; steel: Material; seat: Material }, x: number, z: number) {
  k.box(0.9, 0.42, 0.62, m.body, x + 0.1, 0.36, z, 0.06);
  k.box(0.32, 0.36, 0.6, m.dark, x + 0.48, 0.42, z, 0.05); // counterweight
  k.box(0.28, 0.08, 0.3, m.seat, x + 0.15, 0.62, z, 0.03);
  k.box(0.08, 0.32, 0.3, m.seat, x + 0.3, 0.78, z, 0.03);
  // Roll cage.
  for (const [dx, dz] of [[-0.18, -0.27], [-0.18, 0.27], [0.4, -0.27], [0.4, 0.27]]) k.box(0.04, 0.72, 0.04, m.dark, x + dx, 0.93, z + dz, 0.01);
  k.box(0.66, 0.04, 0.6, m.dark, x + 0.11, 1.3, z, 0.01);
  // Mast and forks.
  for (const dz of [-0.2, 0.2]) k.box(0.06, 1.35, 0.06, m.steel, x - 0.38, 0.68, z + dz, 0.01);
  k.box(0.06, 0.3, 0.5, m.steel, x - 0.42, 0.3, z, 0.01);
  for (const dz of [-0.15, 0.15]) k.box(0.62, 0.035, 0.08, m.steel, x - 0.72, 0.1, z + dz, 0.005);
  // Wheels.
  for (const [dx, dz] of [[-0.22, -0.33], [-0.22, 0.33], [0.38, -0.33], [0.38, 0.33]]) {
    k.box(0.26, 0.26, 0.1, m.dark, x + dx, 0.13, z + dz, 0.1);
  }
}

/** Low machine cabinet with a control panel and status lamps. */
export function machine(k: Kit, m: { body: Material; panel: Material; screen: Material; lampA: Material; lampB: Material; dark: Material }, x: number, z: number, w = 0.7, d = 0.7, h = 1.05) {
  k.box(w, h, d, m.body, x, h / 2, z, 0.05);
  k.box(w + 0.04, 0.08, d + 0.04, m.dark, x, 0.04, z, 0.02);
  k.box(w * 0.7, 0.32, 0.04, m.panel, x, h * 0.62, z + d / 2 + 0.01, 0.02);
  k.box(w * 0.45, 0.16, 0.02, m.screen, x - w * 0.08, h * 0.64, z + d / 2 + 0.035, 0.01);
  k.sphere(0.03, m.lampA, x + w * 0.22, h * 0.7, z + d / 2 + 0.04);
  k.sphere(0.03, m.lampB, x + w * 0.22, h * 0.58, z + d / 2 + 0.04);
  // Signal tower on top.
  k.cyl(0.02, 0.02, 0.25, m.dark, x + w * 0.3, h + 0.12, z - d * 0.3, 8);
  k.cyl(0.045, 0.045, 0.08, m.lampA, x + w * 0.3, h + 0.27, z - d * 0.3, 12);
  k.cyl(0.045, 0.045, 0.08, m.lampB, x + w * 0.3, h + 0.35, z - d * 0.3, 12);
}
