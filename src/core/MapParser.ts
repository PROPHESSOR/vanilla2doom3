// Copyright (c) 2018-2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import ByteTools from './utils/ByteTools';
import type { WadParser } from './WadParser';
import { Vertex } from './structures/vertex';
import { Linedef } from './structures/linedef';
import { Sidedef } from './structures/sidedef';
import { Sector } from './structures/sector';
import { Thing } from './structures/thing';

const DOOM_LINEDEF_FLAGS = ['blocking', 'blockmonsters', 'twosided', 'dontpegtop', 'dontpegbottom', 'secret', 'blocksound', 'dontdraw', 'mapped'] as const;
const DOOM_THING_FLAGS = ['skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'ambush', 'single', 'dm', 'coop'] as const;
export class MapParser {
  vertexes: Vertex[] | null = null;
  linedefs: Linedef[] | null = null;
  sectors: Sector[] | null = null;
  sidedefs: Sidedef[] | null = null;
  things: Thing[] | null = null;

  constructor(public wad: WadParser) { }

  parse(mapIndex: number): void {
    const { THINGS, LINEDEFS, SIDEDEFS, VERTEXES, SECTORS } = this.wad.getMapLumps(mapIndex);
    if (!(THINGS && LINEDEFS && SIDEDEFS && VERTEXES && SECTORS)) {
      throw new Error('Failed to get map lumps');
    }

    const vBuf = VERTEXES.read();
    const sdBuf = SIDEDEFS.read();
    const secBuf = SECTORS.read();
    const ldBuf = LINEDEFS.read();
    const thBuf = THINGS.read();

    this.vertexes = this.parseVertexes(vBuf);
    this.sidedefs = this.parseSidedefs(sdBuf);
    this.sectors = this.parseSectors(secBuf);
    this.linedefs = this.parseLinedefs(ldBuf);
    this.things = this.parseThings(thBuf);
  }

  private parseVertexes(buf: ByteTools): Vertex[] {
    const out: Vertex[] = [];
    for (let i = 0; buf.tell() < buf.length; i++) {
      const x = buf.readInt16();
      const y = buf.readInt16();
      out.push(new Vertex(this, i, x, y));
    }
    return out;
  }

  private parseSidedefs(buf: ByteTools): Sidedef[] {
    /*
      Bytes 0-1: Texture x offset (short)
      Bytes 0-3: Texture y offset (short)
      Bytes 4-11: Upper texture name (8 byte string)
      Bytes 12-19: Lower texture name (8 byte string)
      Bytes 20-27: Middle texture name (8 byte string)
      Bytes 28-29: Sector id (short)
    */

    const out: Sidedef[] = [];
    for (let i = 0; buf.tell() < buf.length; i++) {
      const offsetx = buf.readInt16();
      const offsety = buf.readInt16();
      const uppertex = trimTex(buf.readString(8));
      const lowertex = trimTex(buf.readString(8));
      const middletex = trimTex(buf.readString(8));
      const sector = buf.readInt16();
      out.push(new Sidedef(this, i, offsetx, offsety, uppertex, lowertex, middletex, sector));
    }
    return out;
  }

  private parseSectors(buf: ByteTools): Sector[] {
    /*
    Bytes 0-1: Floor height (short)
    Bytes 2-3: Ceiling height (short)
    Bytes 4-11: Floor texture name (8 byte string)
    Bytes 12-19: Ceiling texture name (8 byte string)
    Bytes 20-27: Light level (short)
    Bytes 28-29: Special effects type (short)
    Bytes 30-31: Tag (short)
    */

    const out: Sector[] = [];
    for (let i = 0; buf.tell() < buf.length; i++) {
      const floor = buf.readInt16();
      const height = buf.readInt16();
      const floortex = trimTex(buf.readString(8));
      const ceiltex = trimTex(buf.readString(8));
      const light = buf.readInt16();
      const special = buf.readInt16();
      const tag = buf.readInt16();
      out.push(new Sector(this, i, floor, height, floortex, ceiltex, light, special, tag));
    }
    return out;
  }

  private parseLinedefs(buf: ByteTools): Linedef[] {
    /*
    Bytes 0-1: Start VERTEX (short)
    Bytes 2-3: End VERTEX (short)
    Bytes 4-5: Attributes (short)
    Bytes 6-7: Special effects type (short)
    Bytes 8-9: Tag (short)
    Bytes 10-11: Right SIDEDEF (short)
    Bytes 12-13: Left SIDEDEF (short)
    */

    const out: Linedef[] = [];
    for (let i = 0; buf.tell() < buf.length; i++) {
      const v1 = buf.readInt16();
      const v2 = buf.readInt16();
      const flags = decodeFlags(buf.readInt16(), DOOM_LINEDEF_FLAGS);
      const action = buf.readInt16();
      const tag = buf.readInt16();
      const front = buf.readInt16();
      const back = buf.readInt16();
      out.push(new Linedef(this, i, v1, v2, flags, action, {}, front, back));
    }
    return out;
  }

  private parseThings(buf: ByteTools): Thing[] {
    /*
    Bytes 0-1: Location (x) (short)
    Bytes 2-3: Location (y) (short)
    Bytes 4-5: Facing angle (short)
    Bytes 6-7: Type ID (short)
    Bytes 8-9: Flags (short)
    */

    const out: Thing[] = [];
    for (let i = 0; buf.tell() < buf.length; i++) {
      const x = buf.readInt16();
      const y = buf.readInt16();
      const angle = buf.readInt16();
      const type = buf.readInt16();
      const flags = decodeFlags(buf.readInt16(), DOOM_THING_FLAGS);
      out.push(new Thing(this, i, x, y, angle, type, flags));
    }
    return out;
  }
}

function decodeFlags(bits: number, names: readonly string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (name !== undefined) out[name] = ((bits >> i) & 1) === 1;
  }
  return out;
}

function trimTex(s: string): string {
  return s.replace(/\x00/g, '').trim();
}
