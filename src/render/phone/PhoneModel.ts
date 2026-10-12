// Procedural phone: rounded body with bevel, display with screen UI, camera island,
// buttons. Every parameter change is animated (morph + paint sweep).

import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { phoneDims, type PhoneDims } from '../../sim/phoneSpec';
import { mergeChildren } from '../mergeChildren';
import { drawPhoneScreen } from '../textures';

export interface PhoneVisual {
  colorHex: string | null;
  shapeId: string;
  displaySize: number;
  kitYear: number;
  finishId: string;
  materialId?: string;
  lenses: number;
}

/** Target paint roughness / metalness for a material + finish combination. */
function surface(v: PhoneVisual): { roughness: number; metalness: number; clearcoat: number } {
  if (!v.colorHex) return { roughness: 0.65, metalness: 0.05, clearcoat: 0.1 };
  const matte = v.finishId === 'matte';
  switch (v.materialId) {
    case 'aluminium':
      return { roughness: matte ? 0.5 : 0.3, metalness: 0.85, clearcoat: matte ? 0 : 0.4 };
    case 'titanium':
      return { roughness: matte ? 0.55 : 0.38, metalness: 0.9, clearcoat: 0 };
    case 'glass':
      return { roughness: matte ? 0.35 : 0.06, metalness: 0.1, clearcoat: 1 };
    default:
      return { roughness: matte ? 0.55 : 0.26, metalness: 0.05, clearcoat: matte ? 0.2 : 1 };
  }
}

const PRIMER = new Color('#6f7378');
/** Scene units per millimetre: phones are oversized showcase models. */
export const PHONE_SCALE = 0.0048;

function roundedRect(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedRectFine(w: number, h: number, r: number): Shape {
  // absarc gives perfectly circular corners for the body silhouette.
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.max(0.2, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function bodyGeometry(d: PhoneDims): BufferGeometry {
  const t = d.thickness;
  const bevel = Math.min(t * 0.42, d.corner * 0.9, 4.2);
  const bt = Math.min(bevel, (t - 0.6) / 2);
  const depth = t - 2 * bt;
  const shape = roundedRectFine(d.width - 2 * bevel, d.height - 2 * bevel, Math.max(0.4, d.corner - bevel));
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 12,
  });
  g.translate(0, 0, -depth / 2);
  const out = toCreasedNormals(g, Math.PI / 3);
  g.dispose();
  return out;
}

const ease = {
  outBack(t: number) {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inOut(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
};

type DimKey = 'width' | 'height' | 'thickness' | 'corner' | 'displayW' | 'displayH' | 'displayOffsetY';
const DIM_KEYS: DimKey[] = ['width', 'height', 'thickness', 'corner', 'displayW', 'displayH', 'displayOffsetY'];

export class PhoneModel {
  readonly group = new Group();
  /** Inner pivot centred on the phone (rotations/bob apply here). */
  readonly pivot = new Group();
  private body: Mesh;
  private bodyMat: MeshPhysicalMaterial;
  private glass: Mesh;
  private screen: Mesh;
  private screenCanvas: HTMLCanvasElement;
  private screenTex: CanvasTexture;
  private island = new Group();
  private buttons = new Group();
  private details = new Group();
  private sharedMats: Material[] = [];

  private from: PhoneDims;
  private to: PhoneDims;
  private cur: PhoneDims;
  private morphT = 1;
  private visual: PhoneVisual;

  private paintUniforms = {
    uOld: { value: new Color() },
    uNew: { value: new Color() },
    uSweep: { value: 1e4 },
    uGlow: { value: 0 },
  };
  private paintT = 1;
  private paintFromRough = 0.3;
  private paintToRough = 0.3;
  private onPaintDone: (() => void) | null = null;

  constructor(visual: PhoneVisual, opts: { detail?: 'hero' | 'prop' } = {}) {
    this.visual = { ...visual };
    const dims = phoneDims(visual);
    this.from = { ...dims };
    this.to = { ...dims };
    this.cur = { ...dims };

    const col = visual.colorHex ? new Color(visual.colorHex) : PRIMER.clone();
    this.paintUniforms.uOld.value.copy(col);
    this.paintUniforms.uNew.value.copy(col);
    this.bodyMat = new MeshPhysicalMaterial({
      color: col,
      metalness: 0.05,
      roughness: visual.colorHex ? 0.28 : 0.65,
      clearcoat: visual.colorHex ? 1 : 0.1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.1,
    });
    this.installPaintShader();
    this.body = new Mesh(bodyGeometry(dims), this.bodyMat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;

    const glassMat = new MeshPhysicalMaterial({
      color: '#05060a',
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.4,
    });
    this.glass = new Mesh(new BufferGeometry(), glassMat);

    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = opts.detail === 'prop' ? 128 : 384;
    this.screenCanvas.height = Math.round(this.screenCanvas.width * 1.5);
    drawPhoneScreen(this.screenCanvas, visual.colorHex);
    this.screenTex = new CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = SRGBColorSpace;
    this.screenTex.anisotropy = 4;
    const screenMat = new MeshPhysicalMaterial({
      color: '#000000',
      emissive: '#ffffff',
      emissiveMap: this.screenTex,
      emissiveIntensity: 0.9,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 0.9,
    });
    this.screen = new Mesh(new BufferGeometry(), screenMat);
    this.sharedMats.push(glassMat, screenMat);

    this.pivot.add(this.body, this.glass, this.screen, this.island, this.buttons, this.details);
    this.group.add(this.pivot);
    this.pivot.scale.setScalar(PHONE_SCALE);
    this.rebuild(true);
  }

  private installPaintShader() {
    const u = this.paintUniforms;
    this.bodyMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vLocalY;\nuniform vec3 uOld;\nuniform vec3 uNew;\nuniform float uSweep;\nuniform float uGlow;',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float paintMix = smoothstep(uSweep + 2.0, uSweep - 2.0, vLocalY);
          diffuseColor.rgb = mix(uOld, uNew, paintMix);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float band = exp(-pow((vLocalY - uSweep) / 2.5, 2.0));
          totalEmissiveRadiance += (uNew * 0.6 + vec3(0.6)) * band * uGlow;`,
        );
    };
    this.bodyMat.customProgramCacheKey = () => 'phone-paint';
  }

  /** Applies a new visual design with animation. */
  setVisual(next: PhoneVisual, onPaintDone?: () => void) {
    const prev = this.visual;
    this.visual = { ...next };
    const geomChanged = prev.shapeId !== next.shapeId || prev.displaySize !== next.displaySize || prev.kitYear !== next.kitYear;
    if (geomChanged) {
      this.from = { ...this.cur };
      this.to = phoneDims(next);
      this.morphT = 0;
    }
    const surfaceChanged = prev.materialId !== next.materialId || prev.finishId !== next.finishId;
    if (surfaceChanged && prev.colorHex === next.colorHex) {
      // Re-run the paint sweep in the same colour to show the new surface.
      this.paintUniforms.uOld.value.copy(this.currentColor());
      this.paintFromRough = this.bodyMat.roughness;
      this.paintToRough = surface(next).roughness;
      this.paintT = 0;
    }
    this.bodyMat.metalness = surface(next).metalness;
    // Aurora: thin-film shimmer that shifts with the viewing angle.
    const aurora = next.finishId === 'aurora' && !!next.colorHex;
    this.bodyMat.iridescence = aurora ? 1 : 0;
    this.bodyMat.iridescenceIOR = 1.8;
    this.bodyMat.iridescenceThicknessRange = [180, 620];
    if (prev.colorHex !== next.colorHex) {
      this.paintUniforms.uOld.value.copy(this.currentColor());
      this.paintUniforms.uNew.value.set(next.colorHex ?? PRIMER.getHex());
      this.paintFromRough = this.bodyMat.roughness;
      this.paintToRough = surface(next).roughness;
      this.paintT = 0;
      this.onPaintDone = onPaintDone ?? null;
      drawPhoneScreen(this.screenCanvas, next.colorHex);
      this.screenTex.needsUpdate = true;
    }
    if (prev.lenses !== next.lenses) this.rebuild(true);
  }

  private currentColor(): Color {
    const u = this.paintUniforms;
    return this.paintT >= 1 ? u.uNew.value.clone() : u.uOld.value.clone().lerp(u.uNew.value, this.paintT);
  }

  /** Returns true while an animation is running. */
  update(dt: number): boolean {
    let active = false;
    if (this.morphT < 1) {
      this.morphT = Math.min(1, this.morphT + dt / 0.55);
      const k = ease.outBack(this.morphT);
      for (const key of DIM_KEYS) this.cur[key] = this.from[key] + (this.to[key] - this.from[key]) * k;
      this.cur.screenToBody = this.to.screenToBody;
      this.rebuild(false);
      active = true;
    }
    if (this.paintT < 1) {
      this.paintT = Math.min(1, this.paintT + dt / 0.9);
      const k = ease.inOut(this.paintT);
      const h = this.cur.height / 2 + 4;
      this.paintUniforms.uSweep.value = -h + 2 * h * k;
      this.paintUniforms.uGlow.value = Math.sin(Math.PI * this.paintT) * 1.2;
      this.bodyMat.roughness = this.paintFromRough + (this.paintToRough - this.paintFromRough) * k;
      this.bodyMat.clearcoat = surface(this.visual).clearcoat * k + (1 - k) * this.bodyMat.clearcoat;
      if (this.paintT >= 1) {
        this.paintUniforms.uOld.value.copy(this.paintUniforms.uNew.value);
        this.paintUniforms.uSweep.value = 1e4;
        this.paintUniforms.uGlow.value = 0;
        this.bodyMat.color.copy(this.paintUniforms.uNew.value);
        const done = this.onPaintDone;
        this.onPaintDone = null;
        done?.();
      }
      active = true;
    }
    return active;
  }

  private rebuild(full: boolean) {
    const d = this.cur;
    this.body.geometry.dispose();
    this.body.geometry = bodyGeometry(d);

    const front = d.thickness / 2;
    const glassW = d.displayW + 3;
    const glassH = d.displayH + 3;
    this.glass.geometry.dispose();
    this.glass.geometry = new ShapeGeometry(roundedRect(glassW, glassH, 2.2), 6);
    this.glass.position.set(0, d.displayOffsetY, front + 0.06);

    this.screen.geometry.dispose();
    const sg = new ShapeGeometry(roundedRect(d.displayW, d.displayH, 1.2), 6);
    // Map UVs to 0..1 across the display.
    const pos = sg.attributes.position;
    const uv = sg.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / d.displayW + 0.5, pos.getY(i) / d.displayH + 0.5);
    }
    this.screen.geometry = sg;
    this.screen.position.set(0, d.displayOffsetY, front + 0.12);

    if (full || this.morphT >= 1) this.buildDetails(d);
    else this.layoutDetails(d);
  }

  /** During a morph only the detail groups are shifted (cheap); details are rebuilt at the end. */
  private builtFor: PhoneDims | null = null;

  private layoutDetails(d: PhoneDims) {
    const b = this.builtFor;
    if (!b) return this.buildDetails(d);
    const sx = d.width / b.width;
    const sy = d.height / b.height;
    const sz = d.thickness / b.thickness;
    for (const g of [this.island, this.buttons, this.details]) g.scale.set(sx, sy, sz);
  }

  private mats: Record<string, Material> | null = null;

  private getMats() {
    if (!this.mats) {
      this.mats = {
        dark: new MeshPhysicalMaterial({ color: '#0b0c10', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
        ring: new MeshStandardMaterial({ color: '#c9ced6', metalness: 1, roughness: 0.22 }),
        lens: new MeshPhysicalMaterial({
          color: '#05070d',
          roughness: 0.02,
          metalness: 0.2,
          clearcoat: 1,
          iridescence: 1,
          iridescenceIOR: 1.6,
          iridescenceThicknessRange: [250, 600],
        }),
        flash: new MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffe9b8', emissiveIntensity: 0.6, roughness: 0.3 }),
        slot: new MeshStandardMaterial({ color: '#16181d', roughness: 0.6 }),
      };
      this.sharedMats.push(...Object.values(this.mats));
    }
    return this.mats;
  }

  private buildDetails(d: PhoneDims) {
    const m = this.getMats();
    this.builtFor = { ...d };
    for (const g of [this.island, this.buttons, this.details]) g.scale.set(1, 1, 1);
    for (const grp of [this.island, this.buttons, this.details]) {
      for (const c of grp.children) (c as Mesh).geometry?.dispose();
      grp.clear();
    }
    const back = -d.thickness / 2;
    const front = d.thickness / 2;

    // Camera island (top-left of the back).
    const lenses = Math.max(1, Math.min(5, this.visual.lenses));
    const islandW = lenses > 1 ? 24 : 15;
    const islandH = lenses > 2 ? 30 : lenses > 1 ? 24 : 15;
    const ix = d.width / 2 - islandW / 2 - 6;
    const iy = d.height / 2 - islandH / 2 - 6;
    const islandGeo = new ExtrudeGeometry(roundedRect(islandW, islandH, Math.min(6, islandW / 3)), {
      depth: 0.6,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.5,
      bevelSegments: 3,
      curveSegments: 8,
    });
    const island = new Mesh(islandGeo, m.dark);
    island.rotation.y = Math.PI;
    island.position.set(ix, iy, back - 0.05);
    this.island.add(island);
    const s = 5.6;
    const layouts: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[0, s * 0.95], [0, -s * 0.95]],
      3: [[-s * 0.9, s * 0.9], [s * 0.9, s * 0.9], [-s * 0.9, -s * 0.9]],
      4: [[-s * 0.9, s * 0.9], [s * 0.9, s * 0.9], [-s * 0.9, -s * 0.9], [s * 0.9, -s * 0.9]],
      5: [[-s, s * 1.2], [s, s * 1.2], [-s, -s * 0.2], [s, -s * 0.2], [0, -s * 1.6]],
    };
    const spots = layouts[lenses];
    const r = lenses > 1 ? 4 : 4.4;
    for (const [lx, ly] of spots) {
      const ring = new Mesh(new CylinderGeometry(r, r, 1.6, 28), m.ring);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(ix - lx, iy + ly, back - 1.2);
      this.island.add(ring);
      const lens = new Mesh(new CylinderGeometry(r * 0.72, r * 0.72, 1.7, 28), m.lens);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(ix - lx, iy + ly, back - 1.3);
      this.island.add(lens);
    }
    const flash = new Mesh(new CylinderGeometry(1.4, 1.4, 1, 16), m.flash);
    flash.rotation.x = Math.PI / 2;
    flash.position.set(ix - islandW / 2 - 4, iy + islandH / 2 - 3, back - 0.3);
    this.island.add(flash);

    // Logo disc on the back.
    const logo = new Mesh(new CylinderGeometry(4.2, 4.2, 0.4, 32), m.ring);
    logo.rotation.x = Math.PI / 2;
    logo.position.set(0, d.height * 0.05, back - 0.1);
    this.details.add(logo);

    // Buttons (right: power, left: volume).
    const btn = (h: number, x: number, y: number) => {
      const b = new Mesh(new RoundedBoxGeometry(1.6, h, Math.min(3.2, d.thickness * 0.4), 2, 0.6), this.bodyMat);
      b.position.set(x, y, 0);
      this.buttons.add(b);
    };
    btn(10, d.width / 2 + 0.3, d.height / 2 - 26);
    btn(8, -d.width / 2 - 0.3, d.height / 2 - 22);
    btn(8, -d.width / 2 - 0.3, d.height / 2 - 33);

    // Earpiece + front camera.
    const ear = new Mesh(new RoundedBoxGeometry(10, 1.4, 0.3, 2, 0.5), m.slot);
    ear.position.set(0, d.displayOffsetY + d.displayH / 2 + Math.max(3, (d.height / 2 - d.displayOffsetY - d.displayH / 2) / 2), front + 0.05);
    this.details.add(ear);
    const fcam = new Mesh(new CylinderGeometry(1.1, 1.1, 0.3, 16), m.lens);
    fcam.rotation.x = Math.PI / 2;
    fcam.position.set(ear.position.x + 9, ear.position.y, front + 0.1);
    this.details.add(fcam);
    // Port on the bottom.
    const port = new Mesh(new RoundedBoxGeometry(8, 1.4, 2.4, 2, 0.6), m.slot);
    port.position.set(0, -d.height / 2 + 0.2, 0);
    this.details.add(port);
    for (const g of [this.island, this.buttons, this.details]) mergeChildren(g);
  }

  /** Height of the phone in scene units. */
  get sceneHeight(): number {
    return this.cur.height * PHONE_SCALE;
  }

  dispose() {
    this.group.traverse((o) => {
      const mesh = o as Mesh;
      mesh.geometry?.dispose();
    });
    this.bodyMat.dispose();
    this.screenTex.dispose();
    for (const m of this.sharedMats) m.dispose();
  }
}
