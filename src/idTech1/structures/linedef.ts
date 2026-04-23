/**
 * Copyright (c) 2018-2022 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import type { MapParser } from '../MapParser';
import type { Vertex } from './vertex';
import type { Sidedef } from './sidedef';

export interface LinedefArgs {
  arg1?: number;
  arg2?: number;
  arg3?: number;
  arg4?: number;
  arg5?: number;
}

export type LinedefFlags = Record<string, boolean>;

export interface LinedefOther {
  [key: string]: unknown;
}

export class Linedef {
  declare _id: number;
  declare v1: number;
  declare v2: number;
  declare sidefront: number;
  declare sideback: number;
  declare arg0: number;
  declare arg1: number;
  declare arg2: number;
  declare arg3: number;
  declare arg4: number;
  declare special: number;
  metadata: Record<string, unknown> = {};

  constructor(
    public map: MapParser,
    _id: number = -1,
    v1: number,
    v2: number,
    flags: LinedefFlags,
    special: number,
    args: LinedefArgs = {},
    front: number,
    back: number,
    other: LinedefOther = {}
  ) {
    this._id = _id;

    this.v1 = Number(v1);
    this.v2 = Number(v2);
    this.sidefront = front;
    this.sideback = back;

    this.arg0 = args.arg1 ?? 0;
    this.arg1 = args.arg2 ?? 0;
    this.arg2 = args.arg3 ?? 0;
    this.arg3 = args.arg4 ?? 0;
    this.arg4 = args.arg5 ?? 0;

    this.special = Number(special);

    for (const flag in flags) {
      (this as unknown as Record<string, boolean>)[flag] = Boolean(flags[flag]);
    }

    Object.assign(this, other);
  }

  get vertex1(): Vertex | undefined {
    return this.map.vertexes?.[this.v1];
  }

  get vertex2(): Vertex | undefined {
    return this.map.vertexes?.[this.v2];
  }

  get sideFront(): Sidedef | undefined {
    return this.map.sidedefs?.[this.sidefront];
  }

  get sideBack(): Sidedef | undefined {
    return this.sideback >= 0 ? this.map.sidedefs?.[this.sideback] : undefined;
  }

  toString(): string {
    let out = `linedef//#${this._id}\n{\n`;

    for (const key in this) {
      if (key[0] === '_') continue;
      out += `${key}=${this[key]};\n`;
    }

    out += '}\n';

    return out;
  }
}

/*
linedef
   {
      id = <integer>; // ID of line. Interpreted as tag or scripting id.
                      // Default = -1. *** see below.

      v1 = <integer>; // Index of first vertex. No valid default.
      v2 = <integer>; // Index of second vertex. No valid default.

      // All flags default to false.

      blocking      = <bool>; // true = line blocks things.
      blockmonsters = <bool>; // true = line blocks monsters.
      twosided      = <bool>; // true = line is 2S.
      dontpegtop    = <bool>; // true = upper texture unpegged.
      dontpegbottom = <bool>; // true = lower texture unpegged.
      secret        = <bool>; // true = drawn as 1S on map.
      blocksound    = <bool>; // true = blocks sound.
      dontdraw      = <bool>; // true = line never drawn on map.
      mapped        = <bool>; // true = always appears on map.

      // BOOM passuse flag not supported in Strife/Heretic/Hexen namespaces.

      passuse       = <bool>; // true = passes use action.

      // Strife specific flags. Support for other games is not defined by
      // default and these flags should be ignored when reading maps not for
      // the Strife namespace or maps for a port which supports these flags.

      translucent   = <bool>; // true = line is a Strife translucent line.
      jumpover      = <bool>; // true = line is a Strife railing.
      blockfloaters = <bool>; // true = line is a Strife float-blocker.

      // Note: SPAC flags should be set false in Doom/Heretic/Strife
      // namespace maps. Specials in those games do not support this
      // mechanism and instead imply activation parameters through the
      // special number. All flags default to false.

      playercross   = <bool>; // true = player can cross.
      playeruse     = <bool>; // true = player can use.
      monstercross  = <bool>; // true = monster can cross.
      monsteruse    = <bool>; // true = monster can use.
      impact        = <bool>; // true = projectile can activate.
      playerpush    = <bool>; // true = player can push.
      monsterpush   = <bool>; // true = monster can push.
      missilecross  = <bool>; // true = projectile can cross.
      repeatspecial = <bool>; // true = repeatable special.

      special = <integer>; // Special. Default = 0.
      arg0    = <integer>; // Argument 0. Default = 0.
      arg1    = <integer>; // Argument 1. Default = 0.
      arg2    = <integer>; // Argument 2. Default = 0.
      arg3    = <integer>; // Argument 3. Default = 0.
      arg4    = <integer>; // Argument 4. Default = 0.

      sidefront = <integer>; // Sidedef 1 index. No valid default.
      sideback  = <integer>; // Sidedef 2 index. Default = -1.

      comment = <string>; // A comment. Implementors should attach no special
                          // semantic meaning to this field.
   }
*/