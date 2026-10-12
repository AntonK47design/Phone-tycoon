// Visual & design content for the editor: colors, shape presets, display sizes, materials.

export interface ColorDef {
  id: string;
  hex: string;
  /** Initially available (Phase 1 palette). */
  starter: boolean;
}

export const COLORS: ColorDef[] = [
  { id: 'graphite', hex: '#2c3038', starter: true },
  { id: 'snow', hex: '#e6e3da', starter: true },
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
  /** Available without research. */
  starter?: boolean;
}

export const SHAPES: ShapeDef[] = [
  { id: 'round', bezelSide: 5, bezelTop: 15, bezelBottom: 15, corner: 11, thickness: 12.5, cost: 0, devPoints: 0, starter: true },
  { id: 'boxy', bezelSide: 4, bezelTop: 13, bezelBottom: 13, corner: 4.5, thickness: 11.5, cost: 3, devPoints: 1, starter: true },
  { id: 'slim', bezelSide: 3.5, bezelTop: 12, bezelBottom: 12, corner: 8, thickness: 9.8, cost: 12, devPoints: 3, starter: true },
  { id: 'blade', bezelSide: 2.8, bezelTop: 10, bezelBottom: 10, corner: 7, thickness: 8.4, cost: 22, devPoints: 5 },
  { id: 'edge', bezelSide: 1.8, bezelTop: 7, bezelBottom: 7, corner: 9, thickness: 7.9, cost: 30, devPoints: 6 },
  { id: 'fullscreen', bezelSide: 1.2, bezelTop: 3.5, bezelBottom: 3.5, corner: 10, thickness: 7.6, cost: 40, devPoints: 7 },
  // Foldable: a book that opens into a small tablet (thicker, pricey, very striking).
  { id: 'fold', bezelSide: 1.4, bezelTop: 3.5, bezelBottom: 3.5, corner: 9, thickness: 11.5, cost: 120, devPoints: 10 },
  // Rollable: the screen unrolls from a slim body.
  { id: 'roll', bezelSide: 0.9, bezelTop: 2.5, bezelBottom: 2.5, corner: 11, thickness: 7.0, cost: 160, devPoints: 12 },
];

export function shapeById(id: string): ShapeDef {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}

/** Display diagonals offered from the start (inches); bigger ones come from research. */
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
  { id: 'glass', design: 8.6, year: 2012, cost: 30, metalness: 0.1, roughness: 0.08 },
  { id: 'ceramic', design: 9.4, year: 2024, cost: 55, metalness: 0.05, roughness: 0.15 },
  { id: 'transparent', design: 9.8, year: 2041, cost: 70, metalness: 0.0, roughness: 0.05 },
  { id: 'nano', design: 10, year: 2047, cost: 80, metalness: 0.6, roughness: 0.25 },
  { id: 'titanium', design: 9.2, year: 2020, cost: 48, metalness: 0.9, roughness: 0.4 },
];

export function materialById(id: string): MaterialDef {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

export interface FinishDef {
  id: string;
  /** Design bonus. */
  bonus: number;
  cost: number;
  /** Cosmetic reward (calendar), not researched. */
  cosmetic?: boolean;
}

export const FINISHES: FinishDef[] = [
  { id: 'gloss', bonus: 0, cost: 0 },
  { id: 'matte', bonus: 0.5, cost: 2 },
  { id: 'aurora', bonus: 0.7, cost: 3, cosmetic: true },
];

export function finishById(id: string): FinishDef {
  return FINISHES.find((f) => f.id === id) ?? FINISHES[0];
}

export const PACKAGING = { basic: { design: 5, cost: 3 } } as const;
