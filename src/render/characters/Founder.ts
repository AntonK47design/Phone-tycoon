// Stylized founder figure with procedural typing / cheering animation.

import { mergeChildren } from '../mergeChildren';
import { BoxGeometry, CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, type BufferGeometry, type Material } from 'three';

type Mood = 'typing' | 'cheer' | 'idle';

export class Founder {
  readonly root = new Group();
  private body = new Group();
  private head = new Group();
  private armL = new Group();
  private armR = new Group();
  private foreL = new Group();
  private foreR = new Group();
  private mood: Mood = 'typing';
  private moodTime = 0;
  private mats: Material[] = [];

  constructor() {
    const mat = (color: string, roughness = 0.75, metalness = 0) => {
      const x = new MeshStandardMaterial({ color, roughness, metalness });
      this.mats.push(x);
      return x;
    };
    const skin = mat('#f1c9a5', 0.7);
    const hoodie = mat('#4f7cff', 0.85);
    const hoodieDark = mat('#3b5fc8', 0.85);
    const pants = mat('#2f3a55', 0.85);
    const hair = mat('#3a2a22', 0.9);
    const shoe = mat('#f4f4f4', 0.6);
    const sole = mat('#ff5a1f', 0.7);
    const dark = mat('#141414', 0.4);
    const white = mat('#ffffff', 0.4);
    const lip = mat('#c9826b', 0.7);
    const phones = mat('#1d1f26', 0.4, 0.3);
    const cord = mat('#f4f4f4', 0.6);

    const m = (geo: BufferGeometry, mt: Material, x = 0, y = 0, z = 0) => {
      const mesh = new Mesh(geo, mt);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      return mesh;
    };

    // Seated pose: hips at stool height.
    this.body.position.y = 0.72;
    this.root.add(this.body);

    // Hoodie: torso, hood on the back, ribbed hem, kangaroo pocket, drawstrings, logo.
    const torso = m(new CapsuleGeometry(0.16, 0.28, 6, 16), hoodie, 0, 0.26, 0);
    torso.scale.set(1, 1, 0.8);
    this.body.add(torso);
    const hood = m(new SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hoodieDark, 0.09, 0.5, 0);
    hood.rotation.z = -1.2;
    hood.scale.set(1, 0.7, 1.1);
    this.body.add(hood);
    const hem = m(new TorusGeometry(0.142, 0.022, 8, 24), hoodieDark, 0, 0.06, 0);
    hem.rotation.x = Math.PI / 2;
    hem.scale.set(1, 0.8, 1);
    this.body.add(hem);
    const collar = m(new TorusGeometry(0.075, 0.022, 8, 20), hoodieDark, 0, 0.52, 0);
    collar.rotation.x = Math.PI / 2;
    this.body.add(collar);
    const pocket = m(new BoxGeometry(0.03, 0.09, 0.18), hoodieDark, -0.13, 0.17, 0);
    this.body.add(pocket);
    for (const side of [-1, 1]) {
      this.body.add(m(new CylinderGeometry(0.006, 0.006, 0.12, 6), cord, -0.135, 0.42, side * 0.035));
    }
    this.body.add(m(new BoxGeometry(0.01, 0.05, 0.05), white, -0.15, 0.33, 0.06));
    // Headphones resting around the neck.
    const band = m(new TorusGeometry(0.1, 0.012, 6, 20, Math.PI), phones, 0, 0.55, 0);
    band.rotation.set(0, Math.PI / 2, Math.PI);
    this.body.add(band);
    for (const side of [-1, 1]) {
      const cup = m(new CylinderGeometry(0.035, 0.035, 0.03, 14), phones, 0, 0.54, side * 0.1);
      cup.rotation.x = Math.PI / 2;
      this.body.add(cup);
    }

    // Legs (thighs forward, shins down), rolled cuffs, sneakers with coloured soles.
    for (const side of [-1, 1]) {
      const thigh = m(new CapsuleGeometry(0.07, 0.3, 4, 12), pants, -0.2, 0.02, side * 0.09);
      thigh.rotation.z = Math.PI / 2;
      this.body.add(thigh);
      this.body.add(m(new CapsuleGeometry(0.06, 0.38, 4, 12), pants, -0.4, -0.25, side * 0.09));
      this.body.add(m(new CylinderGeometry(0.066, 0.066, 0.05, 14), pants, -0.4, -0.42, side * 0.09));
      const foot = m(new CapsuleGeometry(0.052, 0.12, 4, 10), shoe, -0.46, -0.5, side * 0.09);
      foot.rotation.z = Math.PI / 2;
      this.body.add(foot);
      this.body.add(m(new BoxGeometry(0.2, 0.025, 0.1), sole, -0.47, -0.545, side * 0.09));
      this.body.add(m(new BoxGeometry(0.06, 0.012, 0.07), cord, -0.52, -0.46, side * 0.09));
    }

    // Head: face, ears, nose, eyes with whites and pupils, brows, mouth, hair with a fringe.
    this.head.position.y = 0.62;
    this.body.add(this.head);
    this.head.add(m(new SphereGeometry(0.14, 24, 16), skin));
    for (const side of [-1, 1]) {
      const ear = m(new SphereGeometry(0.032, 10, 8), skin, 0.0, 0.0, side * 0.138);
      ear.scale.set(0.8, 1, 0.5);
      this.head.add(ear);
      const sclera = m(new SphereGeometry(0.024, 12, 10), white, -0.122, 0.022, side * 0.05);
      sclera.scale.set(0.6, 1, 1);
      this.head.add(sclera);
      this.head.add(m(new SphereGeometry(0.013, 10, 8), dark, -0.138, 0.02, side * 0.05));
      const brow = m(new BoxGeometry(0.012, 0.012, 0.045), hair, -0.128, 0.065, side * 0.052);
      brow.rotation.x = side * -0.15;
      this.head.add(brow);
    }
    this.head.add(m(new SphereGeometry(0.02, 10, 8), skin, -0.145, -0.012, 0));
    const mouth = m(new TorusGeometry(0.03, 0.007, 6, 12, Math.PI), lip, -0.13, -0.048, 0);
    mouth.rotation.set(0, Math.PI / 2, Math.PI);
    this.head.add(mouth);
    const hairCap = m(new SphereGeometry(0.15, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0.012, 0, 0);
    hairCap.rotation.z = 0.35;
    this.head.add(hairCap);
    const fringe = m(new SphereGeometry(0.07, 12, 8), hair, -0.09, 0.105, 0.03);
    fringe.scale.set(0.7, 0.45, 1.3);
    this.head.add(fringe);

    for (const [arm, fore, side] of [
      [this.armL, this.foreL, -1],
      [this.armR, this.foreR, 1],
    ] as const) {
      arm.position.set(0, 0.44, side * 0.2);
      this.body.add(arm);
      arm.add(m(new CapsuleGeometry(0.055, 0.2, 4, 12), hoodie, 0, -0.12, 0));
      fore.position.y = -0.24;
      arm.add(fore);
      fore.add(m(new CapsuleGeometry(0.05, 0.12, 4, 12), hoodie, 0, -0.07, 0));
      const cuff = m(new CylinderGeometry(0.052, 0.052, 0.04, 12), hoodieDark, 0, -0.15, 0);
      fore.add(cuff);
      const hand = m(new SphereGeometry(0.045, 12, 10), skin, 0, -0.2, 0);
      hand.scale.set(0.8, 1.1, 1);
      fore.add(hand);
    }
    for (const g of [this.body, this.head, this.armL, this.armR, this.foreL, this.foreR]) mergeChildren(g, { colored: 'single' });
  }

  setMood(mood: Mood) {
    this.mood = mood;
    this.moodTime = 0;
  }

  update(t: number, dt: number) {
    this.moodTime += dt;
    if (this.mood === 'cheer' && this.moodTime > 3.2) this.setMood('typing');
    if (this.mood === 'typing') {
      // Arms forward onto the keyboard, fast finger taps.
      this.armL.rotation.z = -1.15 + Math.sin(t * 18) * 0.04;
      this.armR.rotation.z = -1.15 + Math.sin(t * 18 + 1.7) * 0.04;
      this.foreL.rotation.z = -0.55 + Math.sin(t * 22 + 0.5) * 0.08;
      this.foreR.rotation.z = -0.55 + Math.sin(t * 21 + 2.1) * 0.08;
      this.armL.rotation.x = this.armR.rotation.x = 0;
      this.head.rotation.z = -0.12 + Math.sin(t * 1.3) * 0.03;
      this.head.rotation.y = Math.sin(t * 0.4) > 0.92 ? 0.7 : 0; // glance at the turntable
      this.body.position.y = 0.72;
      this.body.rotation.z = -0.05;
    } else if (this.mood === 'cheer') {
      const bounce = Math.abs(Math.sin(this.moodTime * 7));
      this.body.position.y = 0.76 + bounce * 0.12;
      this.armL.rotation.x = 2.6 - Math.sin(this.moodTime * 14) * 0.25;
      this.armR.rotation.x = -2.6 + Math.sin(this.moodTime * 14) * 0.25;
      this.armL.rotation.z = this.armR.rotation.z = 0;
      this.foreL.rotation.z = this.foreR.rotation.z = 0;
      this.head.rotation.y = 0.9;
      this.head.rotation.z = 0.15;
      this.body.rotation.z = 0.05;
    } else {
      this.armL.rotation.set(0, 0, -0.2);
      this.armR.rotation.set(0, 0, -0.2);
      this.head.rotation.set(0, Math.sin(t * 0.5) * 0.3, 0);
    }
  }

  dispose() {
    this.root.traverse((o) => (o as Mesh).geometry?.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}
