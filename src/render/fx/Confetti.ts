// Instanced confetti burst with simple physics.

import { Color, DoubleSide, DynamicDrawUsage, InstancedMesh, MeshStandardMaterial, Object3D, PlaneGeometry, Vector3 } from 'three';

const COLORS = ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c', '#ffffff'];

interface Piece {
  p: Vector3;
  v: Vector3;
  rot: Vector3;
  spin: Vector3;
  life: number;
}

export class Confetti {
  readonly mesh: InstancedMesh;
  private pieces: Piece[] = [];
  private dummy = new Object3D();
  private alive = 0;

  constructor(private count = 260) {
    const geo = new PlaneGeometry(0.035, 0.06);
    const mat = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.5, metalness: 0.2, emissive: '#222' });
    this.mesh = new InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const c = new Color();
    for (let i = 0; i < count; i++) {
      this.pieces.push({ p: new Vector3(), v: new Vector3(), rot: new Vector3(), spin: new Vector3(), life: 0 });
      this.mesh.setColorAt(i, c.set(COLORS[i % COLORS.length]));
    }
    this.mesh.count = 0;
  }

  burst(origin: Vector3, power = 1) {
    for (const piece of this.pieces) {
      const a = Math.random() * Math.PI * 2;
      const up = 2.2 + Math.random() * 2.2 * power;
      const out = 0.6 + Math.random() * 1.4 * power;
      piece.p.copy(origin).add(new Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3));
      piece.v.set(Math.cos(a) * out, up, Math.sin(a) * out);
      piece.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      piece.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      piece.life = 3.5 + Math.random() * 1.5;
    }
    this.alive = this.count;
    this.mesh.count = this.count;
  }

  /** Returns true while pieces are alive. */
  update(dt: number): boolean {
    if (this.alive === 0) return false;
    dt = Math.min(dt, 1 / 30);
    let alive = 0;
    this.pieces.forEach((piece, i) => {
      if (piece.life > 0) {
        piece.life -= dt;
        piece.v.y -= 4.2 * dt;
        piece.v.multiplyScalar(1 - 1.6 * dt);
        piece.v.y = Math.max(piece.v.y, -0.9);
        piece.p.addScaledVector(piece.v, dt);
        // Flutter.
        piece.p.x += Math.sin(piece.life * 7 + i) * 0.004;
        if (piece.p.y < 0.01) {
          piece.p.y = 0.01;
          piece.v.set(0, 0, 0);
          piece.spin.multiplyScalar(0.9);
        }
        piece.rot.addScaledVector(piece.spin, dt);
        alive++;
      }
      const s = piece.life > 0 ? Math.min(1, piece.life * 2) : 0;
      this.dummy.position.copy(piece.p);
      this.dummy.rotation.set(piece.rot.x, piece.rot.y, piece.rot.z);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alive = alive;
    if (alive === 0) this.mesh.count = 0;
    return alive > 0;
  }
}
