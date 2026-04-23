/**
 * Copyright (c) 2018-2022 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import type { MapParser } from '../MapParser';
import type { Sector } from './sector';

export class Sidedef {
  declare _id: number;
  declare offsetx: number;
  declare offsety: number;
  declare texturetop: string;
  declare texturebottom: string;
  declare texturemiddle: string;
  declare sector: number;
  metadata: Record<string, unknown> = {};

  constructor(
    public map: MapParser,
    _id: number,
    offsetx: number,
    offsety: number,
    uppertex: string,
    lowertex: string,
    middletex: string,
    sector: number,
    other: Record<string, unknown> = {}
  ) {
    this._id = _id;
    this.offsetx = offsetx;
    this.offsety = offsety;
    this.texturetop = `"${uppertex}"`;
    this.texturebottom = `"${lowertex}"`;
    this.texturemiddle = `"${middletex}"`;
    this.sector = sector;
    Object.assign(this, other);
  }

  get sectorRef(): Sector | undefined {
    return this.map.sectors?.[this.sector];
  }

  toString(): string {
    let out = `sidedef//#${this._id}\n{\n`;
    for (const key in this) {
      if (key[0] === '_') continue;
      out += `${key}=${(this as Record<string, unknown>)[key]};\n`;
    }
    out += '}\n';
    return out;
  }
}

/*
sidedef
   {
      offsetx = <integer>; // X Offset. Default = 0.
      offsety = <integer>; // Y Offset. Default = 0.

      texturetop    = <string>; // Upper texture. Default = "-".
      texturebottom = <string>; // Lower texture. Default = "-".
      texturemiddle = <string>; // Middle texture. Default = "-".

      sector = <integer>; // Sector index. No valid default.

      comment = <string>; // A comment. Implementors should attach no special
                          // semantic meaning to this field.
   }
*/