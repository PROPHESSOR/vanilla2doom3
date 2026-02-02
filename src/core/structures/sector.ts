/**
 * Copyright (c) 2018-2022 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

export class Sector {
  declare _id: number;
  declare heightfloor: number;
  declare heightceiling: number;
  declare texturefloor: string;
  declare textureceiling: string;
  declare lightlevel: number;
  declare special: number;
  declare id: number;

  constructor(
    _id: number,
    floor: number,
    ceiling: number,
    floortex: string,
    ceilingtex: string,
    light: number,
    special: number,
    tag: number,
    other: Record<string, unknown> = {}
  ) {
    this._id = _id;
    this.heightfloor = floor;
    this.heightceiling = ceiling;
    this.texturefloor = floortex;
    this.textureceiling = ceilingtex;
    this.lightlevel = light;
    this.special = special;
    this.id = tag;
    Object.assign(this, other);
  }

  toString(): string {
    let out = `sector//#${this._id}\n{\n`;
    for (const key in this) {
      if (key[0] === '_') continue;
      if (typeof (this as Record<string, unknown>)[key] === 'string') out += `${key}="${(this as Record<string, unknown>)[key]}";\n`;
      else out += `${key}=${(this as Record<string, unknown>)[key]};\n`;
    }
    out += '}\n';
    return out;
  }
}

/*
sector
   {
      heightfloor   = <integer>; // Floor height. Default = 0.
      heightceiling = <integer>; // Ceiling height. Default = 0.

      texturefloor   = <string>; // Floor flat. No valid default.
      textureceiling = <string>; // Ceiling flat. No valid default.

      lightlevel = <integer>; // Light level. Default = 160.

      special = <integer>; // Sector special. Default = 0.
      id      = <integer>; // Sector tag/id. Default = 0.

      comment = <string>; // A comment. Implementors should attach no special
                          // semantic meaning to this field.
   }
*/