// Visual & design content for the editor: colors, shape presets, display sizes, materials.

export interface ColorDef {
  id: string;
  hex: string;
  /** Initially available (Phase 1 palette). */
  starter: boolean;
}

export const COLORS: ColorDef[] = [
  { id: 'graphite', hex: '#2c3038', starter: true },
  { id: 'snow', hex: '#eeeeea', starter: true },
  { id: 'silver', hex: '#c3c7cd', starter: true },
  { id: 'crimson', hex: '#c42f3d', starter: true },
  { id: 'ocean', hex: '#2c6fd8', starter: true },
  { id: 'lime', hex: '#8fcb35', starter: true },
  { id: 'midnight', hex: '#1c2a5e', starter: false },
  { id: 'coral', hex: '#ff7a64', starter: false },
  { id: 'mint', hex: '#7cdcbc', starter: false },
  { id: 'gold', hex: '#d8b26a', starter: false },
];

export function colorById(id: string | null): ColorDef | undefined {
  return COLORS.find((c) => c.id === id);
}

export interface ShapeDef {
  id: string;
  /** Bezels in mm (side / top / bottom). */
  bezelSide: number;
  bezelTop: number;
  bezelBottom: number;
  /** Corner radius in mm. */
  corner: number;
  /** Thickness in mm. */
  thickness: number;
  /** Additional unit cost ($, 2007). */
  cost: number;
  /** Additional design development points. */
  devPoints: number;
}

export const SHAPES: ShapeDef[] = [
  { id: 'round', bezelSide: 5, bezelTop: 15, bezelBottom: 15, corner: 11, thickness: 12.5, cost: 0, devPoints: 0 },
  { id: 'boxy', bezelSide: 4, bezelTop: 13, bezelBottom: 13, corner: 4.5, thickness: 11.5, cost: 3, devPoints: 1 },
  { id: 'slim', bezelSide: 3.5, bezelTop: 12, bezelBottom: 12, corner: 8, thickness: 9.8, cost: 12, devPoints: 3 },
];

export function shapeById(id: string): ShapeDef {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}

/** Display diagonals offered in the Phase-1 editor (inches). */
export const DISPLAY_SIZES = [3.0, 3.5, 4.0];

export interface MaterialDef {
  id: string;
  /** Design base rating 0–10. */
  design: number;
  /** Release year (rating ages slowly after this). */
  year: number;
  cost: number;
  metalness: number;
  roughness: number;
}

export const MATERIALS: MaterialDef[] = [
  { id: 'plastic', design: 6, year: 2007, cost: 6, metalness: 0, roughness: 0.35 },
  { id: 'aluminium', design: 8, year: 2010, cost: 22, metalness: 0.9, roughness: 0.35 },
];

export function materialById(id: string): MaterialDef {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

export interface FinishDef {
  id: string;
  /** Design bonus. */
  bonus: number;
  cost: number;
}

export const FINISHES: FinishDef[] = [
  { id: 'gloss', bonus: 0, cost: 0 },
  { id: 'matte', bonus: 0.5, cost: 2 },
];

export function finishById(id: string): FinishDef {
  return FINISHES.find((f) => f.id === id) ?? FINISHES[0];
}

export const PACKAGING = { basic: { design: 5, cost: 3 } } as const;
