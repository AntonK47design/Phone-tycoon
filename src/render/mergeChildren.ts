// Merges the direct mesh children of a group per material (keeps the group's own
// transform animatable). Used for rigid parts of animated/rebuilt objects.

import { Mesh, type BufferGeometry, type Group, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function mergeChildren(group: Group) {
  const byMat = new Map<Material, { geos: BufferGeometry[]; cast: boolean }>();
  for (const child of [...group.children]) {
    const mesh = child as Mesh;
    if (!mesh.isMesh || mesh.children.length) continue;
    mesh.updateMatrix();
    let g = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    g.clearGroups();
    const mat = mesh.material as Material;
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
    m.receiveShadow = true;
    group.add(m);
  }
}
