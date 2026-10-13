// Merges the direct mesh children of a group (keeps the group's own transform animatable).
// Used for rigid parts of animated/rebuilt objects. With `colored`, every plain-coloured
// part collapses into one vertex-coloured mesh per surface type: a whole head or arm with
// eyes, ears and cuffs costs a single draw call.

import { BufferAttribute, Mesh, MeshStandardMaterial, type BufferGeometry, type Group, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Surface key for plain-coloured standard/physical materials (null = keep its own material). */
export function plainSurfaceKey(mat: Material): string | null {
  if (!(mat instanceof MeshStandardMaterial)) return null;
  if (mat.map || mat.transparent || mat.emissive.getHex() !== 0 || mat.vertexColors) return null;
  // Coarse buckets (glossy / satin / matte × metal or not): small roughness and metalness
  // differences are invisible at diorama scale, and every bucket costs a draw call.
  const r = mat.roughness < 0.35 ? 0.25 : mat.roughness < 0.65 ? 0.5 : 0.8;
  const m = mat.metalness >= 0.5 ? 0.8 : 0;
  return `${r}|${m}|0.5|${mat.side}`;
}

const sharedColored = new Map<string, MeshStandardMaterial>();
/** One vertex-coloured material per surface key, shared by everything that merges. */
export function coloredMaterial(key: string): MeshStandardMaterial {
  let m = sharedColored.get(key);
  if (!m) {
    const [r, mt, e, side] = key.split('|');
    m = new MeshStandardMaterial({ vertexColors: true, roughness: +r, metalness: +mt, envMapIntensity: +e, side: +side as 0 | 1 | 2 });
    sharedColored.set(key, m);
  }
  return m;
}

export function paint(g: BufferGeometry, mat: MeshStandardMaterial) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = mat.color.r;
    c[i * 3 + 1] = mat.color.g;
    c[i * 3 + 2] = mat.color.b;
  }
  g.setAttribute('color', new BufferAttribute(c, 3));
}

/** Single surface for characters and small props: one draw call for all plain parts. */
const SINGLE_KEY = '0.75|0|0.5|0';

export function mergeChildren(group: Group, opts: { colored?: boolean | 'single' } = {}) {
  const byMat = new Map<Material, { geos: BufferGeometry[]; cast: boolean }>();
  for (const child of [...group.children]) {
    const mesh = child as Mesh;
    if (!mesh.isMesh || mesh.children.length || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh) continue;
    mesh.updateMatrix();
    let g = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    g.clearGroups();
    let mat = mesh.material as Material;
    const plain = opts.colored ? plainSurfaceKey(mat) : null;
    const key = plain && opts.colored === 'single' && (mat as MeshStandardMaterial).side === 0 ? SINGLE_KEY : plain;
    if (key) {
      paint(g, mat as MeshStandardMaterial);
      if (g.attributes.uv) g.deleteAttribute('uv');
      mat = coloredMaterial(key);
    }
    if (!byMat.has(mat)) byMat.set(mat, { geos: [], cast: false });
    const entry = byMat.get(mat)!;
    entry.geos.push(g);
    entry.cast ||= mesh.castShadow;
    mesh.geometry.dispose();
    group.remove(mesh);
  }
  for (const [mat, { geos, cast }] of byMat) {
    const ok = geos.every((g) => !!g.attributes.uv) || geos.every((g) => !g.attributes.uv);
    if (!ok) geos.forEach((g) => g.deleteAttribute('uv'));
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new Mesh(merged, mat);
    m.castShadow = cast;
    merged.computeBoundingSphere();
    // Tiny parts are invisible in the shadow map; skip them there.
    if ((merged.boundingSphere?.radius ?? 1) < 0.08) m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
  }
}
