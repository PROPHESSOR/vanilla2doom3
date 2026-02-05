/**
 * Copyright (c) 2018-2022 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import type { MapParser } from '../MapParser';

export class Vertex {
  declare _id: number;
  declare x: string;
  declare y: string;
  metadata: Record<string, unknown> = {};

  constructor(
    public map: MapParser,
    _id: number,
    x: number,
    y: number,
    other: Record<string, unknown> = {}
  ) {
    this._id = _id;
    this.x = x.toFixed(1);
    this.y = y.toFixed(1);
    Object.assign(this, other);
  }

  toString(): string {
    let out = `vertex//#${this._id}\n{\n`;
    for (const key in this) {
      if (key[0] === '_') continue;
      out += `${key}=${(this as Record<string, unknown>)[key]};\n`;
    }
    out += '}\n';
    return out;
  }
}

/*
vertex
   {
      x = <float>; // X coordinate. No valid default.
      y = <float>; // Y coordinate. No valid default.
   }
*/