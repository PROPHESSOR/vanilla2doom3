/**
 * Copyright (c) 2018-2022 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import type { MapParser } from '../MapParser';

export class Thing {
  declare _id: number;
  declare x: number;
  declare y: number;
  declare angle: number;
  declare type: number;
  metadata: Record<string, unknown> = {};

  constructor(
    public map: MapParser,
    _id: number,
    x: number,
    y: number,
    angle: number,
    type: number,
    flags: Record<string, boolean> = {},
    other: Record<string, unknown> = {}
  ) {
    this._id = _id;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.type = type;
    for (const flag in flags) {
      (this as unknown as Record<string, boolean>)[flag] = Boolean(flags[flag]);
    }
    Object.assign(this, other);
  }

  toString(): string {
    let out = `thing//#${this._id}\n{\n`;
    for (const key in this) {
      if (key[0] === '_') continue;
      out += `${key}=${(this as Record<string, unknown>)[key]};\n`;
    }
    out += '}\n';
    return out;
  }
}

/*
thing
   {
      id = <integer>; // Thing ID. Default = 0.

      x = <float>; // X coordinate. No valid default.
      y = <float>; // Y coordinate. No valid default.

      height = <float>; // Z height relative to floor. Default = 0.
                        // (Relative to ceiling for SPAWNCEILING items).

      angle = <integer>; // Map angle of thing in degrees. Default = 0 (East).

      type = <integer>; // DoomedNum. No valid default.

      // All flags default to false.

      skill1      = <bool>; // true = in skill 1.
      skill2      = <bool>; // true = in skill 2.
      skill3      = <bool>; // true = in skill 3.
      skill4      = <bool>; // true = in skill 4.
      skill5      = <bool>; // true = in skill 5.
      ambush      = <bool>; // true = thing is deaf.
      single      = <bool>; // true = in SP mode.
      dm          = <bool>; // true = in DM mode.
      coop        = <bool>; // true = in Coop.

      // MBF friend flag not supported in Strife/Heretic/Hexen namespaces.

      friend      = <bool>; // true = MBF friend.

      // Hexen flags; not supported in Doom/Strife/Heretic namespaces.

      dormant     = <bool>; // true = dormant thing.
      class1      = <bool>; // true = Present for pclass 1.
      class2      = <bool>; // true = Present for pclass 2.
      class3      = <bool>; // true = Present for pclass 3.


      // Strife specific flags. Support for other games is not defined by
      // default and these flags should be ignored when reading maps not for
      // the Strife namespace or maps for a port which supports these flags.
      standing    = <bool>; // true = Strife NPC flag.
      strifeally  = <bool>; // true = Strife ally flag.
      translucent = <bool>; // true = Strife translucency flag.
      invisible   = <bool>; // true = Strife invisibility flag.

      // Note: suggested editor defaults for all skill, gamemode, and player
      // class flags is true rather than the UDMF default of false.

      // Thing special semantics are only defined for the Hexen namespace or
      // ports which implement this feature in their own namespace.

      special = <integer>; // Scripting special. Default = 0;
      arg0    = <integer>; // Argument 0. Default = 0.
      arg1    = <integer>; // Argument 1. Default = 0.
      arg2    = <integer>; // Argument 2. Default = 0.
      arg3    = <integer>; // Argument 3. Default = 0.
      arg4    = <integer>; // Argument 4. Default = 0.

      comment = <string>; // A comment. Implementors should attach no special
                          // semantic meaning to this field.
   }
*/