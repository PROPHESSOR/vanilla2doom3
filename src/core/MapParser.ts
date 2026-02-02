// Copyright (c) 2018-2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT


import ByteTools from './utils/ByteTools';

export class MapParser {
  public things: RawThing[] | null = null;
  public vertexes: RawVertex[] | null = null;
  public linedefs: RawLinedef[] | null = null;
  public sectors: RawSector[] | null = null;
  public sidedefs: RawSidedef[] | null = null;

  constructor(public map: ByteTools) { }

  getThings(buffer: ByteTools) {
    if (this.things) return this.things;

    /*
    Bytes 0-1: Location (x) (short)
    Bytes 2-3: Location (y) (short)
    Bytes 4-5: Facing angle (short)
    Bytes 6-7: Type ID (short)
    Bytes 8-9: Flags (short)
    */

    const out = [];

    for (let i = 0; i < buffer.length; i += 10) {
      out.push({
        x: buffer.readInt16(),
        y: buffer.readInt16(),
        angle: buffer.readInt16(),
        tid: buffer.readInt16(),
        flags: buffer.readInt16(),
      });
    }

    this.things = out;

    return out;
  }

  getVertexes(buffer: ByteTools) {
    if (this.vertexes) return this.vertexes;

    const out = [];

    for (let i = 0; i < buffer.length; i += 4) {
      out.push({
        x: buffer.readInt16(),
        y: buffer.readInt16(),
      });
    }

    this.vertexes = out;

    return out;
  }

  getLinedefs(buffer: ByteTools) {
    if (this.linedefs) return this.linedefs;

    /*
    Bytes 0-1: Start VERTEX (short)
    Bytes 2-3: End VERTEX (short)
    Bytes 4-5: Attributes (short)
    Bytes 6-7: Special effects type (short)
    Bytes 8-9: Tag (short)
    Bytes 10-11: Right SIDEDEF (short)
    Bytes 12-13: Left SIDEDEF (short)
    */

    const out = [];

    for (let i = 0; i < buffer.length; i += 14) {
      out.push({
        v1: buffer.readInt16(),
        v2: buffer.readInt16(),
        flags: buffer.readInt16(),
        action: buffer.readInt16(),
        tag: buffer.readInt16(),
        front: buffer.readInt16(),
        back: buffer.readInt16(),
      });
    }

    this.linedefs = out;

    return out;
  }

  getSectors(buffer: ByteTools) {
    if (this.sidedefs) return this.sidedefs;

    const out = [];

    for (let i = 0; i < buffer.length; i += 26) {
      out.push({
        floor: buffer.readInt16(),
        height: buffer.readInt16(),
        floortex: buffer.readString(8),
        ceiltex: buffer.readString(8),
        light: buffer.readInt16(),
        special: buffer.readInt16(),
        tag: buffer.readInt16(),
      });
    }

    this.sectors = out;

    return out;
  }

  getSides(buffer: ByteTools) {
    if (this.sectors) return this.sectors;

    /*
    Bytes 0-1: Texture x offset (short)
    Bytes 0-3: Texture y offset (short)
    Bytes 4-11: Upper texture name (8 byte string)
    Bytes 12-19: Lower texture name (8 byte string)
    Bytes 20-27: Middle texture name (8 byte string)
    Bytes 28-29: Sector id (short)
    */

    const out = [];

    for (let i = 0; i < buffer.length; i += 30) {
      out.push({
        offsetx: buffer.readInt16(),
        offsety: buffer.readInt16(),
        uppertex: buffer.readString(8),
        lowertex: buffer.readString(8),
        middletex: buffer.readString(8),
        sector: buffer.readInt16(),
      });
    }

    this.sidedefs = out;

    return out;
  }
}

export interface RawThing {
  x: number;
  y: number;
  angle: number;
  tid: number;
  flags: number;
}

export interface RawVertex {
  x: number;
  y: number;
}

export interface RawLinedef {
  v1: number;
  v2: number;
  flags: number;
  action: number;
  tag: number;
  front: number;
  back: number;
}

export interface RawSector {
  floor: number;
  height: number;
  floortex: string;
  ceiltex: string;
  light: number;
  special: number;
  tag: number;
}

export interface RawSidedef {
  offsetx: number;
  offsety: number;
  uppertex: string;
  lowertex: string;
  middletex: string;
  sector: number;
}