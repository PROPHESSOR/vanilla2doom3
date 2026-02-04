// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Vec2 } from './math';
import { vec2Direction, vec2Length, vec2Normalize, vec2Perpendicular, vec2AngleDeg } from './math';
import { rectBrush3d, type RectBrush3dOptions } from './rectBrush3d';

export interface VerticalWallBrushOptions extends RectBrush3dOptions {
  width?: number;
}

/**
 * Generate a vertical wall brush from a 2D line segment (v1 to v2)
 * extruded from zBottom to zTop.
 */
export function verticalWallBrush(
  v1: Vec2,
  v2: Vec2,
  zBottom: number,
  zTop: number,
  options: VerticalWallBrushOptions = {}
): string {
  const width = options.width ?? 8;

  const lineVector = vec2Direction(v1, v2);
  const length = vec2Length(lineVector);

  if (length === 0) {
    console.warn('verticalWallBrush: zero-length line, skipping');
    return '';
  }

  if (zTop <= zBottom) {
    console.warn(`verticalWallBrush: invalid height (${zBottom} to ${zTop}), skipping`);
    return '';
  }

  const dir = vec2Normalize(lineVector);
  const right = vec2Normalize(vec2Perpendicular(dir));

  // Origin is at v1, offset by half width perpendicular to the line
  const origin = {
    x: v1.x - right.x * width / 2,
    y: v1.y - right.y * width / 2,
    z: zBottom,
  };

  const rotation = vec2AngleDeg(dir);
  const height = zTop - zBottom;

  return rectBrush3d(
    origin,
    { width: length, depth: width, height },
    {
      ...options,
      rotationDeg: rotation,
      comment: options.comment ?? `// Wall((${v1.x}, ${v1.y}) to (${v2.x}, ${v2.y}), z=${zBottom} to ${zTop})`,
    }
  );
}
