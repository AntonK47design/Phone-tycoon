// Quality tiers and automatic detection via frame-time measurement (PLAN §4).

export type Quality = 'low' | 'medium' | 'high';
export type QualitySetting = Quality | 'auto';

export interface QualityProfile {
  pixelRatioCap: number;
  shadowMap: number;
  ao: boolean;
  aoSamples: number;
  bloom: boolean;
  tiltShift: boolean;
  smaa: boolean;
  spotShadow: boolean;
}

export const PROFILES: Record<Quality, QualityProfile> = {
  low: { pixelRatioCap: 1, shadowMap: 1024, ao: false, aoSamples: 0, bloom: false, tiltShift: false, smaa: true, spotShadow: false },
  medium: { pixelRatioCap: 1.5, shadowMap: 2048, ao: false, aoSamples: 8, bloom: true, tiltShift: true, smaa: true, spotShadow: false },
  high: { pixelRatioCap: 2, shadowMap: 2048, ao: true, aoSamples: 16, bloom: true, tiltShift: true, smaa: true, spotShadow: true },
};

export function isMobileDevice(): boolean {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return coarse || Math.min(screen.width, screen.height) < 600;
}

export function initialQuality(): Quality {
  return isMobileDevice() ? 'low' : 'medium';
}

/**
 * Collects frame times and proposes a tier change. Checks twice (after warm-up and after
 * one adjustment) and then locks to avoid oscillation.
 */
export class AutoQuality {
  private samples: number[] = [];
  private elapsed = 0;
  private checks = 0;
  private warmup = 3;

  constructor(private readonly mobile: boolean) {}

  reset(warmup = 1.5) {
    this.samples = [];
    this.elapsed = 0;
    this.warmup = warmup;
  }

  /** Feed a frame duration (s). Returns a new tier if one is recommended. */
  sample(dt: number, current: Quality): Quality | null {
    if (this.checks >= 2) return null;
    this.elapsed += dt;
    if (this.elapsed < this.warmup) return null;
    this.samples.push(dt);
    if (this.samples.length < 90) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.checks++;
    this.reset();
    if (median > 1 / 40 && current !== 'low') return current === 'high' ? 'medium' : 'low';
    if (median < 1 / 75 && current === 'medium' && !this.mobile) return 'high';
    if (median < 1 / 58 && current === 'low' && !this.mobile) return 'medium';
    this.checks = 2;
    return null;
  }
}
