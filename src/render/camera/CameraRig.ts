// Spherical camera rig with eased transitions and orbit sequences.

import { PerspectiveCamera, Vector3 } from 'three';

export interface View {
  target: Vector3;
  azimuth: number; // radians, 0 = +z, positive towards +x
  elevation: number; // radians above horizon
  distance: number;
  fov: number;
  /** Tilt-shift strength 0–1 for this view. */
  tiltShift: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function cloneView(v: View): View {
  return { ...v, target: v.target.clone() };
}

export class CameraRig {
  readonly camera: PerspectiveCamera;
  private cur: View;
  private from: View;
  private to: View;
  private t = 1;
  private duration = 1;
  private onDone: (() => void) | null = null;
  /** Extra azimuth orbit applied during launch sequences. */
  private orbit: { t: number; duration: number; turns: number } | null = null;
  private aspect = 1;

  constructor(initial: View) {
    this.camera = new PerspectiveCamera(initial.fov, 1, 0.05, 80);
    this.cur = cloneView(initial);
    this.from = cloneView(initial);
    this.to = cloneView(initial);
    this.apply();
  }

  get view(): View {
    return this.cur;
  }

  setAspect(aspect: number) {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.apply();
  }

  goTo(view: View, duration = 1.2, onDone?: () => void) {
    this.from = cloneView(this.cur);
    this.to = cloneView(view);
    this.t = duration <= 0 ? 1 : 0;
    this.duration = Math.max(duration, 0.001);
    this.onDone = onDone ?? null;
    if (duration <= 0) {
      this.cur = cloneView(view);
      this.apply();
      onDone?.();
    }
  }

  startOrbit(duration: number, turns = 1) {
    this.orbit = { t: 0, duration, turns };
  }

  /** Returns true while the camera is moving. */
  update(dt: number): boolean {
    let moving = false;
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      const k = easeInOut(this.t);
      const f = this.from;
      const to = this.to;
      this.cur.target.lerpVectors(f.target, to.target, k);
      this.cur.azimuth = f.azimuth + (to.azimuth - f.azimuth) * k;
      this.cur.elevation = f.elevation + (to.elevation - f.elevation) * k;
      // Distance eases in log space for natural zooms.
      this.cur.distance = Math.exp(Math.log(f.distance) + (Math.log(to.distance) - Math.log(f.distance)) * k);
      this.cur.fov = f.fov + (to.fov - f.fov) * k;
      this.cur.tiltShift = f.tiltShift + (to.tiltShift - f.tiltShift) * k;
      if (this.t >= 1) {
        const done = this.onDone;
        this.onDone = null;
        done?.();
      }
      moving = true;
    }
    if (this.orbit) {
      this.orbit.t += dt;
      if (this.orbit.t >= this.orbit.duration) this.orbit = null;
      moving = true;
    }
    this.apply();
    return moving;
  }

  private apply() {
    const v = this.cur;
    let az = v.azimuth;
    let dist = v.distance;
    if (this.orbit) {
      const k = easeInOut(Math.min(1, this.orbit.t / this.orbit.duration));
      az += k * Math.PI * 2 * this.orbit.turns;
      dist *= 1 - Math.sin(Math.PI * k) * 0.18;
    }
    // Portrait / narrow screens: pull back so the subject still fits.
    if (this.aspect < 1.2) dist *= 1 + (1.2 - this.aspect) * 0.9;
    const ce = Math.cos(v.elevation);
    this.camera.position.set(
      v.target.x + dist * ce * Math.sin(az),
      v.target.y + dist * Math.sin(v.elevation),
      v.target.z + dist * ce * Math.cos(az),
    );
    this.camera.fov = v.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(v.target);
  }
}
