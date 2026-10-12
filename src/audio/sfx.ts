// Synthesized sound effects (WebAudio, zero download).

type Wave = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;
  private adMuted = false;

  /** Must be called from a user gesture (autoplay policy). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      this.applyVolume();
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.applyVolume();
  }

  /** Mute while an ad plays. */
  setAdMuted(on: boolean) {
    this.adMuted = on;
    this.applyVolume();
  }

  private applyVolume() {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.enabled && !this.adMuted ? 0.55 : 0, this.ctx.currentTime, 0.02);
  }

  private ready(): AudioContext | null {
    return this.ctx && this.master && this.enabled && !this.adMuted ? this.ctx : null;
  }

  private tone(freq: number, dur: number, opts: { type?: Wave; gain?: number; delay?: number; slide?: number; attack?: number } = {}) {
    const ctx = this.ready();
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(freq * opts.slide, t0 + dur);
    const peak = opts.gain ?? 0.25;
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private hiss(dur: number, opts: { from: number; to: number; gain?: number; delay?: number; q?: number }) {
    const ctx = this.ready();
    if (!ctx || !this.noise) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = opts.q ?? 1.2;
    f.frequency.setValueAtTime(opts.from, t0);
    f.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  click() {
    this.tone(1800, 0.04, { type: 'triangle', gain: 0.12 });
  }

  pop(pitch = 1) {
    this.tone(520 * pitch, 0.12, { type: 'sine', gain: 0.25, slide: 1.8 });
    this.tone(1040 * pitch, 0.08, { type: 'triangle', gain: 0.06, delay: 0.01 });
  }

  whoosh() {
    this.hiss(0.45, { from: 300, to: 2400, gain: 0.18 });
  }

  paint() {
    this.hiss(0.5, { from: 3000, to: 900, gain: 0.08, q: 0.6 });
    this.pop(1.2);
  }

  card(i = 0) {
    this.hiss(0.22, { from: 1500, to: 5000, gain: 0.12, delay: 0 });
    this.tone(660 * Math.pow(1.122, i), 0.18, { type: 'triangle', gain: 0.12, delay: 0.08 });
  }

  coin(pitch = 1) {
    this.tone(1320 * pitch, 0.08, { type: 'square', gain: 0.05 });
    this.tone(1980 * pitch, 0.18, { type: 'square', gain: 0.04, delay: 0.05 });
  }

  fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(f, 0.5, { type: 'sawtooth', gain: 0.07, delay: i * 0.11, attack: 0.02 });
      this.tone(f / 2, 0.5, { type: 'triangle', gain: 0.1, delay: i * 0.11 });
    });
    this.tone(1046.5, 1.2, { type: 'triangle', gain: 0.12, delay: 0.44, attack: 0.03 });
    this.tone(1318.5, 1.2, { type: 'sine', gain: 0.08, delay: 0.44, attack: 0.03 });
    this.hiss(1.2, { from: 6000, to: 2000, gain: 0.06, delay: 0.4, q: 0.4 });
  }

  unlock2() {
    [880, 1108.7, 1318.5, 1760].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', gain: 0.1, delay: i * 0.07 }));
  }

  tick() {
    this.tone(2400, 0.02, { type: 'square', gain: 0.03 });
  }

  clock() {
    for (let i = 0; i < 6; i++) this.tone(i % 2 ? 1400 : 1100, 0.05, { type: 'square', gain: 0.04, delay: i * 0.4 });
  }
}

export const sfx = new Sfx();
