// Stylized founder figure with procedural typing / cheering animation.

import { mergeChildren } from '../mergeChildren';
import { CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Material } from 'three';

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
    const skin = new MeshStandardMaterial({ color: '#f1c9a5', roughness: 0.7 });
    const shirt = new MeshStandardMaterial({ color: '#4f7cff', roughness: 0.8 });
    const pants = new MeshStandardMaterial({ color: '#2b2f3f', roughness: 0.85 });
    const hair = new MeshStandardMaterial({ color: '#3a2a22', roughness: 0.9 });
    const shoe = new MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.6 });
    const dark = new MeshStandardMaterial({ color: '#111', roughness: 0.4 });
    this.mats.push(skin, shirt, pants, hair, shoe, dark);

    const m = (geo: import('three').BufferGeometry, mat: Material) => {
      const mesh = new Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    };

    // Seated pose: hips at stool height.
    this.body.position.y = 0.72;
    this.root.add(this.body);

    const torso = m(new CapsuleGeometry(0.16, 0.28, 6, 14), shirt);
    torso.position.y = 0.26;
    torso.scale.set(1, 1, 0.8);
    this.body.add(torso);

    // Legs (thighs forward, shins down).
    for (const side of [-1, 1]) {
      const thigh = m(new CapsuleGeometry(0.07, 0.3, 4, 10), pants);
      thigh.rotation.z = Math.PI / 2;
      thigh.position.set(-0.2, 0.02, side * 0.09);
      this.body.add(thigh);
      const shin = m(new CapsuleGeometry(0.06, 0.38, 4, 10), pants);
      shin.position.set(-0.4, -0.25, side * 0.09);
      this.body.add(shin);
      const foot = m(new CapsuleGeometry(0.05, 0.1, 4, 8), shoe);
      foot.rotation.z = Math.PI / 2;
      foot.position.set(-0.45, -0.5, side * 0.09);
      this.body.add(foot);
    }

    this.head.position.y = 0.62;
    this.body.add(this.head);
    const face = m(new SphereGeometry(0.14, 24, 16), skin);
    this.head.add(face);
    const hairCap = m(new SphereGeometry(0.148, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.rotation.z = 0.35;
    hairCap.position.x = 0.012;
    this.head.add(hairCap);
    for (const side of [-1, 1]) {
      const eye = m(new SphereGeometry(0.018, 10, 8), dark);
      eye.position.set(-0.128, 0.02, side * 0.05);
      this.head.add(eye);
    }

    for (const [arm, fore, side] of [
      [this.armL, this.foreL, -1],
      [this.armR, this.foreR, 1],
    ] as const) {
      arm.position.set(0, 0.44, side * 0.2);
      this.body.add(arm);
      const upper = m(new CapsuleGeometry(0.05, 0.2, 4, 10), shirt);
      upper.position.y = -0.12;
      arm.add(upper);
      fore.position.y = -0.24;
      arm.add(fore);
      const lower = m(new CapsuleGeometry(0.045, 0.18, 4, 10), skin);
      lower.position.y = -0.11;
      fore.add(lower);
    }
    for (const g of [this.body, this.head, this.armL, this.armR, this.foreL, this.foreR]) mergeChildren(g);
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
