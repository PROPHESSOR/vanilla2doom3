// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Plane } from './math';

const DEFAULT_TEXTURE = 'textures/base_floor/sflpanel6';

/** Default scale: 1 texel per world unit assuming 128-wide textures. */
const DEFAULT_TEXTURE_SCALE = 1 / 128;

export interface BrushDef3Options {
  texture?: string;
  /** Horizontal UV scale (repeats per world unit). */
  textureScaleS?: number;
  /** Vertical UV scale (repeats per world unit). */
  textureScaleT?: number;
  comment?: string;
  indent?: number;
}

function prettyNumber(x: number): number | string {
  if (x === 0) return 0;
  if (Number.isInteger(x)) return x;
  return Math.round(x * 1000000) / 1000000;
}

function getPlaneString(plane: Plane, texture: string, scaleS: number, scaleT: number): string {
  const { nx, ny, nz, d } = plane;
  const ss = prettyNumber(scaleS);
  const st = prettyNumber(scaleT);
  return `( ${prettyNumber(nx)} ${prettyNumber(ny)} ${prettyNumber(nz)} ${prettyNumber(d)} ) ( ( ${ss} 0 0 ) ( 0 ${st} 0 ) ) "${texture}" 0 0 0`;
}

/**
 * Generate a brushDef3 from a set of planes.
 * Requires at least 4 planes to form a valid convex brush.
 */
export function brushDef3(planes: Plane[], options: BrushDef3Options = {}): string {
  if (planes.length < 4) {
    throw new Error('brushDef3 requires at least 4 planes');
  }

  const texture = options.texture ?? DEFAULT_TEXTURE;
  const scaleS = options.textureScaleS ?? DEFAULT_TEXTURE_SCALE;
  const scaleT = options.textureScaleT ?? DEFAULT_TEXTURE_SCALE;
  const comment = options.comment ?? '// primitive';
  const indent = options.indent ?? 4;
  const indentStr = ' '.repeat(indent);

  const lines: string[] = [
    comment,
    '{',
    '    brushDef3 {',
  ];

  for (const plane of planes) {
    lines.push('        ' + getPlaneString(plane, texture, scaleS, scaleT));
  }

  lines.push('    }');
  lines.push('}');

  return indentStr + lines.join('\n' + indentStr);
}
