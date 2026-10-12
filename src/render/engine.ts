// Rendering engine and "director" API used by the UI. Reads visual data only –
// no game rules live here.

import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CameraRig, type View } from './camera/CameraRig';
import { Confetti } from './fx/Confetti';
import { PhoneModel, type PhoneVisual } from './phone/PhoneModel';
import { createGradePass, createTiltShiftPass } from './post/passes';
import { AutoQuality, initialQuality, isMobileDevice, PROFILES, type Quality, type QualitySetting } from './quality';
import { buildGarage, TURNTABLE_POS, type GarageRoom } from './rooms/garage';
import { Factory, FACTORY_ORIGIN, type FactoryVisual } from './rooms/factory';
import { Office, OFFICE_ORIGIN, type OfficeVisual } from './rooms/office';
import { Store, STORE_ORIGIN, type StoreVisual } from './rooms/store';
import { OfficeCorner } from './rooms/officeCorner';
import type { Role } from '../data/team';
import { backgroundTexture } from './textures';

export type ViewName = 'intro' | 'overview' | 'editor' | 'launch' | 'office' | 'factory' | 'store';

const TT = TURNTABLE_POS;
const VIEWS: Record<ViewName, View> = {
  intro: { target: new Vector3(0, 0.8, 0), azimuth: 1.35, elevation: 0.8, distance: 26, fov: 30, tiltShift: 1 },
  overview: { target: new Vector3(0.15, 0.95, -0.1), azimuth: 0.62, elevation: 0.5, distance: 11.8, fov: 30, tiltShift: 1 },
  editor: { target: new Vector3(TT.x, 0.56, TT.z), azimuth: 0.3, elevation: 0.2, distance: 1.6, fov: 30, tiltShift: 0.45 },
  launch: { target: new Vector3(TT.x, 0.6, TT.z), azimuth: 0.3, elevation: 0.24, distance: 2.3, fov: 32, tiltShift: 0.5 },
  office: { target: OFFICE_ORIGIN.clone().add(new Vector3(0, 0.7, 0)), azimuth: 0.55, elevation: 0.55, distance: 12, fov: 30, tiltShift: 1 },
  factory: { target: FACTORY_ORIGIN.clone().add(new Vector3(0, 0.6, 0)), azimuth: 0.5, elevation: 0.58, distance: 15, fov: 30, tiltShift: 1 },
  store: { target: STORE_ORIGIN.clone().add(new Vector3(0, 0.8, 0)), azimuth: 0.55, elevation: 0.5, distance: 13, fov: 30, tiltShift: 1 },
};

export interface EngineStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  quality: Quality;
}

type PhoneMode = 'spin' | 'present';

export class Engine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  private rig: CameraRig;
  private composer: EffectComposer;
  private passes: {
    gtao: GTAOPass;
    bloom: UnrealBloomPass;
    tiltH: ShaderPass;
    tiltV: ShaderPass;
    grade: ShaderPass;
    smaa: SMAAPass;
  };
  private key: DirectionalLight;
  private garage: GarageRoom;
  private office: OfficeCorner;
  private hq = new Office();
  private hqLevel = 0;
  private fac = new Factory();
  private facSize = 0;
  private shop = new Store();
  private view: ViewName = 'intro';
  private phone: PhoneModel;
  private confetti = new Confetti();
  private quality: Quality;
  private qualitySetting: QualitySetting = 'auto';
  private auto: AutoQuality;
  private running = false;
  private paused = false;
  private last = 0;
  private time = 0;
  private lastInput = 0;
  private idleAcc = 0;
  private fpsAcc = { frames: 0, time: 0, fps: 0 };
  private firstFrame: (() => void) | null = null;

  private phoneMode: PhoneMode = 'spin';
  private phoneYaw = 0;
  private yawOffset = 0;
  private flourish = { t: 1, from: 0 };
  private launchBoost = 0;
  private launchBoostTarget = 0;
  private night = 0;
  private nightTarget = 0;
  private dayFraction = 0;
  /** True while the game clock runs; keeps the frame rate up. */
  clockRunning = false;

  constructor(private container: HTMLElement) {
    const mobile = isMobileDevice();
    this.quality = initialQuality();
    this.auto = new AutoQuality(mobile);
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.info.autoReset = false;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'scene-canvas';

    // Environment for reflections – generated, no HDR download.
    const pmrem = new PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environmentIntensity = 0.8;
    envScene.dispose();
    pmrem.dispose();
    this.scene.background = backgroundTexture();

    const hemi = new HemisphereLight('#d6e4ff', '#5c4a3e', 0.35);
    this.scene.add(hemi);
    this.key = new DirectionalLight('#fff1e0', 2.5);
    this.key.position.set(5.5, 9, 6.5);
    this.key.castShadow = true;
    const sc = this.key.shadow.camera;
    sc.left = -5.5;
    sc.right = 5.5;
    sc.top = 5.5;
    sc.bottom = -5.5;
    sc.near = 2;
    sc.far = 26;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 3;
    this.scene.add(this.key, this.key.target);
    const rim = new DirectionalLight('#9db8ff', 0.6);
    rim.position.set(-6, 4, -2);
    this.scene.add(rim);

    // Soft contact shadow below the floating diorama.
    const blob = document.createElement('canvas');
    blob.width = blob.height = 128;
    const bctx = blob.getContext('2d')!;
    const grad = bctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, 128, 128);
    const shadow = new Mesh(new PlaneGeometry(12, 10), new MeshBasicMaterial({ map: new CanvasTexture(blob), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.6;
    this.scene.add(shadow);

    this.garage = buildGarage(this.quality);
    this.scene.add(this.garage.root);
    this.office = new OfficeCorner();
    this.scene.add(this.office.group);
    this.scene.add(this.hq.root);
    this.scene.add(this.fac.root);
    this.scene.add(this.shop.root);

    this.phone = new PhoneModel({ colorHex: null, shapeId: 'round', displaySize: 3.5, kitYear: 2007, finishId: 'gloss', lenses: 1 });
    this.garage.heroAnchor.add(this.phone.group);
    this.scene.add(this.confetti.mesh);

    this.rig = new CameraRig(VIEWS.intro);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.rig.camera);
    const gtao = new GTAOPass(this.scene, this.rig.camera, 512, 512);
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.9;
    const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.4, 0.5, 2.4);
    const output = new OutputPass();
    const tiltH = createTiltShiftPass(true);
    const tiltV = createTiltShiftPass(false);
    const grade = createGradePass();
    const smaa = new SMAAPass();
    for (const p of [renderPass, gtao, bloom, output, tiltH, tiltV, grade, smaa]) this.composer.addPass(p);
    this.passes = { gtao, bloom, tiltH, tiltV, grade, smaa };

    this.applyQuality();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  start(onFirstFrame?: () => void) {
    this.firstFrame = onFirstFrame ?? null;
    // Shader warm-up so the first visible frames don't hitch.
    this.renderer.compile(this.scene, this.rig.camera);
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  /** Stops rendering entirely (ads, hidden tab, modal menus). */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.last = performance.now();
  }

  private frame = (now: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    if (this.paused) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    // Idle throttling (render-on-demand): game paused and nothing animating → ~15 fps.
    const animating = this.update(dt);
    const idle = !animating && !this.clockRunning && now - this.lastInput > 3000;
    if (idle) {
      this.idleAcc += dt;
      if (this.idleAcc < 1 / 15) return;
      this.idleAcc = 0;
    }
    this.renderer.info.reset();
    this.composer.render(dt);

    this.fpsAcc.frames++;
    this.fpsAcc.time += dt;
    if (this.fpsAcc.time >= 0.5) {
      this.fpsAcc.fps = this.fpsAcc.frames / this.fpsAcc.time;
      this.fpsAcc.frames = 0;
      this.fpsAcc.time = 0;
    }
    if (!idle && this.qualitySetting === 'auto') {
      const next = this.auto.sample(dt, this.quality);
      if (next) {
        this.quality = next;
        this.applyQuality();
      }
    }
    if (this.firstFrame) {
      const cb = this.firstFrame;
      this.firstFrame = null;
      cb();
    }
  };

  /** Advances animations. Returns true if something is visibly animating. */
  private update(dt: number): boolean {
    this.time += dt;
    const t = this.time;
    let animating = this.rig.update(dt);
    animating = this.phone.update(dt) || animating;
    animating = this.confetti.update(dt) || animating;

    this.launchBoost += (this.launchBoostTarget - this.launchBoost) * Math.min(1, dt * 3);
    this.night += (this.nightTarget - this.night) * Math.min(1, dt * 4);
    if (Math.abs(this.launchBoost - this.launchBoostTarget) > 0.01 || Math.abs(this.night - this.nightTarget) > 0.01) animating = true;
    this.passes.grade.uniforms.night.value = this.night;
    this.key.intensity = 2.5 * (1 - this.night * 0.85);

    // Phone motion: float + spin / present.
    if (this.flourish.t < 1) {
      this.flourish.t = Math.min(1, this.flourish.t + dt / 1.1);
      animating = true;
    }
    const flourishAngle = this.flourish.t < 1 ? (1 - Math.pow(1 - this.flourish.t, 3)) * Math.PI * 2 : 0;
    if (this.phoneMode === 'spin') this.phoneYaw += dt * 0.45;
    else this.phoneYaw = Math.sin(t * 0.45) * 0.55;
    const pivot = this.phone.group;
    pivot.rotation.set(-0.06, this.phoneYaw + this.yawOffset + flourishAngle, 0);
    pivot.position.y = 0.09 + this.phone.sceneHeight / 2 + Math.sin(t * 1.6) * 0.012;

    this.garage.update(t, dt, this.dayFraction, this.launchBoost);
    this.office.update(t);
    if (this.view === 'office') animating = this.hq.update(t, dt) || animating;
    if (this.view === 'factory') animating = this.fac.update(t, dt) || animating;
    if (this.view === 'store') animating = this.shop.update(t, dt) || animating;
    const tilt = this.rig.view.tiltShift * (PROFILES[this.quality].tiltShift ? 1 : 0);
    this.passes.tiltH.uniforms.strength.value = tilt;
    this.passes.tiltV.uniforms.strength.value = tilt;
    this.passes.tiltH.enabled = this.passes.tiltV.enabled = tilt > 0.02;
    return animating;
  }

  // ── Quality ───────────────────────────────────────────────────────────

  setQuality(setting: QualitySetting) {
    this.qualitySetting = setting;
    if (setting !== 'auto') this.quality = setting;
    this.applyQuality();
  }

  private applyQuality() {
    const p = PROFILES[this.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatioCap));
    if (this.key.shadow.mapSize.x !== p.shadowMap) {
      this.key.shadow.mapSize.set(p.shadowMap, p.shadowMap);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
    this.garage.spot.castShadow = p.spotShadow;
    this.passes.gtao.enabled = p.ao;
    if (p.ao) this.passes.gtao.updateGtaoMaterial({ samples: p.aoSamples });
    this.passes.bloom.enabled = p.bloom;
    this.passes.smaa.enabled = p.smaa;
    this.resize();
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    for (const p of [this.passes.tiltH, this.passes.tiltV]) p.uniforms.resolution.value.set(w * pr, h * pr);
    this.rig.setAspect(w / h);
  }

  // ── Input ─────────────────────────────────────────────────────────────

  private bindInput() {
    const el = this.renderer.domElement;
    let dragging = false;
    let lastX = 0;
    const mark = () => (this.lastInput = performance.now());
    window.addEventListener('pointermove', mark, { passive: true });
    window.addEventListener('pointerdown', mark, { passive: true });
    window.addEventListener('keydown', mark);
    el.addEventListener('pointerdown', (e) => {
      if (this.phoneMode !== 'present') return;
      dragging = true;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.yawOffset += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    });
    const end = () => (dragging = false);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ── Director API ──────────────────────────────────────────────────────

  goToView(name: ViewName, duration = 1.2, onDone?: () => void) {
    this.phoneMode = name === 'editor' ? 'present' : 'spin';
    if (name !== 'editor') this.yawOffset = 0;
    this.view = name;
    if (name === 'office') VIEWS.office.distance = [12, 14.5, 17, 20.5][Math.max(1, Math.min(4, this.hqLevel)) - 1];
    if (name === 'factory') VIEWS.factory.distance = [15, 18, 23][Math.max(1, Math.min(3, this.facSize)) - 1];
    const room = name === 'office' || name === 'factory' || name === 'store' ? name : 'garage';
    this.aimShadows(room);
    // Only draw the room the camera looks at (once it has arrived): saves ~40 draw calls.
    if (room === 'office') this.hq.setShown(true);
    else if (room === 'factory') this.fac.setShown(true);
    else if (room === 'store') this.shop.setShown(true);
    else this.garage.root.visible = true;
    this.rig.goTo(VIEWS[name], duration, () => {
      if (this.view === name) {
        this.garage.root.visible = room === 'garage';
        this.hq.setShown(room === 'office');
        this.fac.setShown(room === 'factory');
        this.shop.setShown(room === 'store');
      }
      onDone?.();
    });
    this.lastInput = performance.now();
  }

  setPhone(visual: PhoneVisual, opts: { flourish?: boolean } = {}) {
    this.phone.setVisual(visual);
    if (opts.flourish) this.spin();
    this.lastInput = performance.now();
  }

  spin() {
    this.flourish = { t: 0, from: 0 };
  }

  /** Moves the shadow frustum to the room the camera looks at. */
  private aimShadows(room: 'garage' | 'office' | 'factory' | 'store') {
    const off = room === 'office' ? OFFICE_ORIGIN : room === 'factory' ? FACTORY_ORIGIN : room === 'store' ? STORE_ORIGIN : new Vector3();
    this.key.position.set(5.5, 9, 6.5).add(off);
    this.key.target.position.copy(off);
    const sc = this.key.shadow.camera;
    const r = room === 'factory' ? 9 : room === 'office' ? 8 : 5.5;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.updateProjectionMatrix();
  }

  get currentView(): ViewName {
    return this.view;
  }

  /** Factory diorama: lines, belt speed and warehouse fill. */
  setFactory(v: FactoryVisual) {
    const grew = v.size !== this.facSize;
    this.facSize = v.size;
    if (grew && this.view === 'factory') this.goToView('factory', 1);
    this.fac.setVisual(v);
  }

  /** Store diorama: phones on display and shoppers. */
  setStore(v: StoreVisual) {
    this.shop.setVisual(v);
  }

  /** Office diorama: level, buildings and staff. */
  setOffice(v: OfficeVisual) {
    const grew = v.level !== this.hqLevel;
    this.hqLevel = v.level;
    // Bigger room: pull the camera back.
    if (grew && this.view === 'office') this.goToView('office', 1);
    this.hq.setVisual(v);
    this.lastInput = performance.now();
  }

  /** Shows the Phase-2 office corner with the company's neon sign. */
  setPhase(phase: number, companyName: string) {
    this.office.setVisible(phase >= 2, companyName);
  }

  setNight(on: boolean) {
    this.nightTarget = on ? 1 : 0;
  }

  setDayFraction(f: number) {
    this.dayFraction = f;
  }

  /** Launch show: orbit, confetti, LED party, cheering founder. */
  playLaunch() {
    this.goToView('launch', 0.9);
    this.rig.startOrbit(3.4, 1);
    this.launchBoostTarget = 1;
    this.garage.founder.setMood('cheer');
    const origin = new Vector3();
    this.phone.group.getWorldPosition(origin);
    setTimeout(() => this.confetti.burst(origin.setY(0.9), 1), 350);
    this.spin();
  }

  endLaunch() {
    this.launchBoostTarget = 0;
  }

  confettiAt(where: 'phone' | 'bench') {
    const p = new Vector3();
    if (where === 'phone') this.phone.group.getWorldPosition(p);
    else p.copy(this.garage.benchLabelPos);
    this.confetti.burst(p.setY(Math.max(p.y, 0.9)), 0.6);
  }

  /** Projects a named anchor to CSS pixel coordinates. */
  project(anchor: 'phone' | 'bench' | 'founder' | `team:${Role}`): { x: number; y: number; visible: boolean } {
    const p = new Vector3();
    if (anchor.startsWith('team:')) {
      if (this.view !== 'office' || !this.hq.teamAnchor(anchor.slice(5) as Role, p)) return { x: 0, y: 0, visible: false };
    } else if (anchor === 'phone') {
      this.phone.group.getWorldPosition(p);
      p.y += this.phone.sceneHeight * 0.6;
    } else if (anchor === 'founder') {
      this.garage.founder.root.getWorldPosition(p);
      p.y += 1.62;
    } else p.copy(this.garage.benchLabelPos);
    p.project(this.rig.camera);
    const el = this.renderer.domElement;
    return {
      x: ((p.x + 1) / 2) * el.clientWidth,
      y: ((1 - p.y) / 2) * el.clientHeight,
      visible: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1,
    };
  }

  stats(): EngineStats {
    const info = this.renderer.info.render;
    return { fps: this.fpsAcc.fps, drawCalls: info.calls, triangles: info.triangles, quality: this.quality };
  }

  get currentQuality(): Quality {
    return this.quality;
  }

  /** Background colour helper for loading overlay matching. */
  static readonly bgColor = new Color('#1a1d3b');
}
