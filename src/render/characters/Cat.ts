// The garage cat. Sleeps on the beanbag, breathes, flicks its tail, twitches an ear.

import { Color, ConeGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, type Material } from 'three';
import { mergeChildren } from '../mergeChildren';

export class Cat {
  readonly root = new Group();
  private body: Mesh;
  private head = new Group();
  private earL!: Mesh;
  private tail: InstancedMesh;
  private dummy = new Object3D();
  private mats: Material[] = [];
  private twitchAt = 4;

  constructor() {
    const fur = new MeshStandardMaterial({ color: '#e58a33', roughness: 0.9 });
    const belly = new MeshStandardMaterial({ color: '#f6e7d3', roughness: 0.9 });
    const dark = new MeshStandardMaterial({ color: '#2a1d14', roughness: 0.6 });
    const pink = new MeshStandardMaterial({ color: '#e99a9a', roughness: 0.8 });
    this.mats.push(fur, belly, dark, pink);
    const m = (g: import('three').BufferGeometry, mat: Material) => {
      const mesh = new Mesh(g, mat);
      mesh.castShadow = true;
      return mesh;
    };

    // Curled-up loaf.
    this.body = m(new SphereGeometry(0.16, 20, 14), fur);
    this.body.scale.set(1.25, 0.62, 1);
    this.body.position.y = 0.09;
    this.root.add(this.body);
    const chest = m(new SphereGeometry(0.09, 14, 10), belly);
    chest.position.set(0.13, 0.07, 0.04);
    this.root.add(chest);

    this.head.position.set(0.15, 0.1, 0.07);
    this.head.rotation.set(0.2, -0.5, -0.35); // resting on its paws
    this.root.add(this.head);
    const skull = m(new SphereGeometry(0.075, 16, 12), fur);
    this.head.add(skull);
    const muzzle = m(new SphereGeometry(0.035, 10, 8), belly);
    muzzle.position.set(0.055, -0.02, 0);
    this.head.add(muzzle);
    const nose = m(new SphereGeometry(0.01, 6, 6), pink);
    nose.position.set(0.088, -0.008, 0);
    this.head.add(nose);
    for (const side of [-1, 1]) {
      // Closed eyes: tiny dark slits.
      const eye = m(new SphereGeometry(0.012, 8, 6), dark);
      eye.scale.set(0.4, 0.25, 1.2);
      eye.position.set(0.062, 0.018, side * 0.03);
      this.head.add(eye);
      const ear = m(new ConeGeometry(0.03, 0.06, 10), fur);
      ear.position.set(-0.005, 0.07, side * 0.04);
      ear.rotation.x = side * 0.3;
      this.head.add(ear);
      if (side === -1) this.earL = ear;
    }
    this.earL ??= this.head.children[this.head.children.length - 1] as Mesh;

    // The ear that twitches stays separate; the rest of the head is merged.
    this.head.remove(this.earL);
    mergeChildren(this.head);
    this.head.add(this.earL);

    // Tail: one instanced chain of spheres (white base colour, tinted per instance).
    const tailMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    this.mats.push(tailMat);
    this.tail = new InstancedMesh(new SphereGeometry(0.03, 10, 8), tailMat, 9);
    this.tail.castShadow = true;
    const furC = new Color('#e58a33');
    const darkC = new Color('#2a1d14');
    for (let i = 0; i < 9; i++) this.tail.setColorAt(i, i > 6 ? darkC : furC);
    this.root.add(this.tail);
  }

  update(t: number) {
    const breathe = 1 + Math.sin(t * 1.6) * 0.035;
    this.body.scale.set(1.25 * breathe, 0.62 * breathe, 1 * breathe);
    // Tail curls around the front, the tip flicks lazily.
    const flick = Math.sin(t * 0.9) * 0.5 + Math.sin(t * 2.3) * 0.15;
    for (let i = 0; i < 9; i++) {
      const a = -0.6 - i * 0.28 + (i > 5 ? flick * (i - 5) * 0.12 : 0);
      const r = 0.2 + i * 0.004;
      this.dummy.position.set(Math.cos(a) * r * 1.1 - 0.02, 0.04 + i * 0.002, Math.sin(a) * r);
      this.dummy.scale.setScalar(1 - i * 0.05);
      this.dummy.updateMatrix();
      this.tail.setMatrixAt(i, this.dummy.matrix);
    }
    this.tail.instanceMatrix.needsUpdate = true;
    if (t > this.twitchAt) {
      const k = t - this.twitchAt;
      this.earL.rotation.z = Math.sin(k * 40) * 0.25 * Math.max(0, 1 - k * 4);
      if (k > 0.3) this.twitchAt = t + 5 + Math.random() * 7;
    }
  }

  dispose() {
    this.root.traverse((o) => (o as Mesh).geometry?.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}
