// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Vec2, Vec3, Plane } from './math';
import { vec2Rotate, vec2Normalize, vec2Perpendicular, planeFromNormalPoint } from './math';
import { brushDef3, type BrushDef3Options } from './brushDef3';

export interface RectBrush3dOptions extends BrushDef3Options {
  rotationDeg?: number;
}

/**
 * Generate a rectangular brush from a 3D position and size.
 * Optional rotation in XY plane (rotation around Z axis).
 */
export function rectBrush3d(
  position: Vec3,
  size: { width: number; depth: number; height: number },
  options: RectBrush3dOptions = {}
): string {
  const { x, y, z } = position;
  const { width, depth, height } = size;

  if (width <= 0 || depth <= 0 || height <= 0) {
    console.warn(`rectBrush3d: invalid size (${width}, ${depth}, ${height}), skipping`);
    return '';
  }

  const rotation = options.rotationDeg ?? 0;

  // Forward and right vectors in XY plane
  const forward: Vec2 = vec2Normalize(vec2Rotate({ x: 1, y: 0 }, rotation));
  const right: Vec2 = vec2Normalize(vec2Perpendicular(forward));

  // Bottom and top planes (pointing down and up)
  const bottomPlane = planeFromNormalPoint({ x: 0, y: 0, z: -1 }, { x, y, z });
  const topPlane = planeFromNormalPoint({ x: 0, y: 0, z: 1 }, { x, y, z: z + height });

  // Side planes (outward normals)
  const frontPoint: Vec3 = { x: x + forward.x * width, y: y + forward.y * width, z };
  const backPoint: Vec3 = { x, y, z };
  const rightPoint: Vec3 = { x: x + right.x * depth, y: y + right.y * depth, z };
  const leftPoint: Vec3 = { x, y, z };

  const frontPlane = planeFromNormalPoint({ x: forward.x, y: forward.y, z: 0 }, frontPoint);
  const backPlane = planeFromNormalPoint({ x: -forward.x, y: -forward.y, z: 0 }, backPoint);
  const rightPlane = planeFromNormalPoint({ x: right.x, y: right.y, z: 0 }, rightPoint);
  const leftPlane = planeFromNormalPoint({ x: -right.x, y: -right.y, z: 0 }, leftPoint);

  const planes: Plane[] = [
    bottomPlane,
    topPlane,
    frontPlane,
    backPlane,
    rightPlane,
    leftPlane,
  ];

  const defaultComment = options.comment ?? `// Rect3d((${x}, ${y}, ${z}), (${width}, ${depth}, ${height}))`;

  return brushDef3(planes, {
    ...options,
    comment: defaultComment,
  });
}
