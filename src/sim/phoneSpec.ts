// Physical dimensions derived from a design. Pure – shared by scoring and rendering.

import { displayAspect } from '../data/eras';
import { shapeById } from '../data/design';
import type { PhoneDesign } from './state';

export interface PhoneDims {
  /** Body width / height / thickness in mm. */
  width: number;
  height: number;
  thickness: number;
  corner: number;
  /** Display width / height in mm. */
  displayW: number;
  displayH: number;
  /** Display centre offset from body centre (mm, +y = up). */
  displayOffsetY: number;
  screenToBody: number;
}

const MM_PER_INCH = 25.4;

export function phoneDims(design: Pick<PhoneDesign, 'shapeId' | 'displaySize' | 'kitYear'>): PhoneDims {
  const shape = shapeById(design.shapeId);
  const aspect = displayAspect(design.kitYear);
  const diag = design.displaySize * MM_PER_INCH;
  const displayW = diag / Math.sqrt(1 + aspect * aspect);
  const displayH = displayW * aspect;
  const width = displayW + 2 * shape.bezelSide;
  const height = displayH + shape.bezelTop + shape.bezelBottom;
  // Rounded corners remove a little front area.
  const cornerLoss = (4 - Math.PI) * shape.corner * shape.corner;
  const screenToBody = (displayW * displayH) / (width * height - cornerLoss);
  return {
    width,
    height,
    thickness: shape.thickness,
    corner: shape.corner,
    displayW,
    displayH,
    displayOffsetY: (shape.bezelBottom - shape.bezelTop) / 2,
    screenToBody,
  };
}
