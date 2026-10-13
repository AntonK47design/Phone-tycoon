// Merges static meshes to keep draw calls low. Plain coloured materials (no maps, no
// emission, opaque) are collapsed into shared vertex-coloured materials keyed by
// roughness/metalness, so dozens of props cost only a handful of draws.

import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { plainSurfaceKey } from '../mergeChildren';

function plainKey(mat: Material): string | null {
  return plainSurfaceKey(mat);
}

export class StaticBatcher {
  private buckets = new Map<Material, BufferGeometry[]>();
  private shadowless = new Set<Material>();
  private shared = new Map<string, MeshStandardMaterial>();

  /** Adds a mesh (with its current world transform) to the batch. */
  add(mesh: Mesh, opts: { castShadow?: boolean } = {}) {
    mesh.updateWorldMatrix(true, false);
    let mat = mesh.material as Material;
    let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    const count = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2));

    const base = plainKey(mat);
    const key = base && `${base}|${opts.castShadow === false}`;
    if (key) {
      const src = mat as MeshStandardMaterial;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = src.color.r;
        colors[i * 3 + 1] = src.color.g;
        colors[i * 3 + 2] = src.color.b;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      if (!this.shared.has(key)) {
        const [r, m, e] = base!.split('|');
        this.shared.set(key, new MeshStandardMaterial({ vertexColors: true, roughness: +r, metalness: +m, envMapIntensity: +e, side: src.side }));
      }
      mat = this.shared.get(key)!;
    }
    g.clearGroups();
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat)!.push(g);
    if (opts.castShadow === false) this.shadowless.add(mat);
  }

  /** Builds one mesh per bucket and adds them to `parent`. */
  flush(parent: Object3D) {
    for (const [mat, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new Mesh(merged, mat);
      merged.computeBoundingSphere();
      mesh.castShadow = !this.shadowless.has(mat) && (merged.boundingSphere?.radius ?? 1) > 0.08;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
    }
    this.buckets.clear();
  }

  dispose() {
    this.shared.forEach((m) => m.dispose());
  }
}
