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
import { Seg } from './structures/seg';
import { Subsector } from './structures/subsector';
import { buildSubsectors } from './nodebuilder';

const DOOM_LINEDEF_FLAGS = ['blocking', 'blockmonsters', 'twosided', 'dontpegtop', 'dontpegbottom', 'secret', 'blocksound', 'dontdraw', 'mapped'] as const;
const DOOM_THING_FLAGS = ['skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'ambush', 'single', 'dm', 'coop'] as const;

const GL_VERT_MAGIC_V2 = 0x32644e67; // 'gNd2' LE
const GL_VERT_MAGIC_V5 = 0x35644e67; // 'gNd5' LE
const VERT_IS_GL_V1 = 1 << 15;
const VERT_IS_GL_V5 = 1 << 31;

export interface StoredMap {
  vertexes: { _id: number; x: string; y: string }[];
  linedefs: { _id: number; v1: number; v2: number; sidefront: number; sideback: number; special: number; arg0: number; arg1: number; arg2: number; arg3: number; arg4: number; flags: Record<string, boolean> }[];
  sidedefs: { _id: number; offsetx: number; offsety: number; uppertex: string; lowertex: string; middletex: string; sector: number }[];
  sectors: { _id: number; heightfloor: number; heightceiling: number; texturefloor: string; textureceiling: string; lightlevel: number; special: number; id: number }[];
  things: { _id: number; x: number; y: number; angle: number; type: number; flags: Record<string, boolean> }[];
  segs: { _id: number; startVertex: number; endVertex: number; angle: number; linedef: number; side: number; offset: number }[];
  subsectors: { _id: number; segCount: number; firstSeg: number }[];
  useGlNodes?: boolean;
  glVertexes?: { x: number; y: number }[];
}

export class MapParser {
  vertexes: Vertex[] | null = null;
  linedefs: Linedef[] | null = null;
  sectors: Sector[] | null = null;
  sidedefs: Sidedef[] | null = null;
  things: Thing[] | null = null;
  segs: Seg[] | null = null;
  subsectors: Subsector[] | null = null;
  useGlNodes = false;
  glVertexes: { x: number; y: number }[] = [];
  metadata: Record<string, unknown> = {};

  constructor(public wad: WadParser) { }

  /** Resolve vertex index to coordinates (map vertex or GL vertex). */
  getVertexForSeg(unifiedIndex: number): { x: number; y: number } {
    const v = this.vertexes ?? [];
    if (this.useGlNodes && unifiedIndex >= v.length) {
      const gl = this.glVertexes[unifiedIndex - v.length];
      return gl ?? { x: 0, y: 0 };
    }
    const vert = v[unifiedIndex];
    return vert ? { x: parseFloat(vert.x), y: parseFloat(vert.y) } : { x: 0, y: 0 };
  }

  toStoredMap(): StoredMap {
    const v = this.vertexes ?? [];
    const ld = this.linedefs ?? [];
    const sd = this.sidedefs ?? [];
    const sec = this.sectors ?? [];
    const th = this.things ?? [];
    const seg = this.segs ?? [];
    const ss = this.subsectors ?? [];
    const linedefFlags = (l: Linedef): Record<string, boolean> => {
      const flags: Record<string, boolean> = {};
      const obj = l as unknown as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (key === 'map' || key.startsWith('_') || ['v1', 'v2', 'sidefront', 'sideback', 'special', 'arg0', 'arg1', 'arg2', 'arg3', 'arg4'].includes(key)) continue;
        const val = obj[key];
        if (typeof val === 'boolean') flags[key] = val;
      }
      return flags;
    };
    const thingFlags = (t: Thing): Record<string, boolean> => {
      const flags: Record<string, boolean> = {};
      const obj = t as unknown as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (key === 'map' || key.startsWith('_') || ['x', 'y', 'angle', 'type'].includes(key)) continue;
        const val = obj[key];
        if (typeof val === 'boolean') flags[key] = val;
      }
      return flags;
    };
    return {
      vertexes: v.map((x) => ({ _id: x._id, x: x.x, y: x.y })),
      linedefs: ld.map((l) => ({ _id: l._id, v1: l.v1, v2: l.v2, sidefront: l.sidefront, sideback: l.sideback, special: l.special, arg0: l.arg0, arg1: l.arg1, arg2: l.arg2, arg3: l.arg3, arg4: l.arg4, flags: linedefFlags(l) })),
      sidedefs: sd.map((s) => ({ _id: s._id, offsetx: s.offsetx, offsety: s.offsety, uppertex: s.texturetop.replace(/^"|"$/g, ''), lowertex: s.texturebottom.replace(/^"|"$/g, ''), middletex: s.texturemiddle.replace(/^"|"$/g, ''), sector: s.sector })),
      sectors: sec.map((s) => ({ _id: s._id, heightfloor: s.heightfloor, heightceiling: s.heightceiling, texturefloor: s.texturefloor, textureceiling: s.textureceiling, lightlevel: s.lightlevel, special: s.special, id: s.id })),
      things: th.map((t) => ({ _id: t._id, x: t.x, y: t.y, angle: t.angle, type: t.type, flags: thingFlags(t) })),
      segs: seg.map((s) => ({ _id: s._id, startVertex: s.startVertex, endVertex: s.endVertex, angle: s.angle, linedef: s.linedef, side: s.side, offset: s.offset })),
      subsectors: ss.map((s) => ({ _id: s._id, segCount: s.segCount, firstSeg: s.firstSeg })),
      ...(this.useGlNodes && { useGlNodes: true, glVertexes: this.glVertexes }),
    };
  }

  loadFromSnapshot(stored: StoredMap): void {
    if (!stored.useGlNodes || !stored.glVertexes) {
      throw new Error('Saved map is from an older version (no subsector data in snapshot). Select your WAD file and choose the map again.');
    }
    this.vertexes = stored.vertexes.map((v) => new Vertex(this, v._id, parseFloat(v.x), parseFloat(v.y)));
    this.sidedefs = stored.sidedefs.map((s) => new Sidedef(this, s._id, s.offsetx, s.offsety, s.uppertex, s.lowertex, s.middletex, s.sector));
    this.sectors = stored.sectors.map((s) => new Sector(this, s._id, s.heightfloor, s.heightceiling, s.texturefloor, s.textureceiling, s.lightlevel, s.special, s.id));
    this.linedefs = stored.linedefs.map((l) => new Linedef(this, l._id, l.v1, l.v2, l.flags, l.special, { arg1: l.arg0, arg2: l.arg1, arg3: l.arg2, arg4: l.arg3, arg5: l.arg4 }, l.sidefront, l.sideback));
    this.things = stored.things.map((t) => new Thing(this, t._id, t.x, t.y, t.angle, t.type, t.flags));
    this.segs = stored.segs.map((s) => new Seg(this, s._id, s.startVertex, s.endVertex, s.angle, s.linedef, s.side, s.offset));
    this.subsectors = stored.subsectors.map((s) => new Subsector(this, s._id, s.segCount, s.firstSeg));
    this.useGlNodes = true;
    this.glVertexes = stored.glVertexes;
  }

  parse(mapIndex: number): void {
    const lumps = this.wad.getMapLumps(mapIndex);
    const { THINGS, LINEDEFS, SIDEDEFS, VERTEXES, SECTORS } = lumps;
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

    // Always build subsectors from geometry using our node builder
    console.log('Building subsectors from geometry...');
    this.buildSubsectorsFromGeometry();
  }

  buildSubsectorsFromGeometry(): void {
    if (!this.vertexes || !this.linedefs || !this.sidedefs || !this.sectors) {
      throw new Error('Map geometry not loaded');
    }

    // Convert to node builder input format
    const input = {
      vertices: this.vertexes.map((v) => ({
        x: parseFloat(v.x),
        y: parseFloat(v.y),
      })),
      linedefs: this.linedefs.map((ld) => ({
        v1: ld.v1,
        v2: ld.v2,
        sidefront: ld.sidefront,
        sideback: ld.sideback,
        two_sided: (ld as any).twosided ?? false,
        special: ld.special,
      })),
      sidedefs: this.sidedefs.map((sd) => ({
        sector: sd.sector,
      })),
      sectors: this.sectors.map((s, i) => ({
        index: i,
      })),
    };

    // Build subsectors
    const output = buildSubsectors(input, { debug: true });

    // Convert to MapParser format
    this.glVertexes = output.newVertices;
    this.segs = output.segs.map(
      (s, i) =>
        new Seg(this, i, s.startVertex, s.endVertex, s.angle, s.linedef, s.side, s.offset)
    );
    this.subsectors = output.subsectors.map(
      (ss, i) => new Subsector(this, i, ss.segCount, ss.firstSeg)
    );
    this.useGlNodes = true;

    console.log(
      `Built ${this.subsectors.length} subsectors, ${this.segs.length} segs, ${this.glVertexes.length} new vertices`
    );
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
      out.push(new Linedef(this, i, v1, v2, flags, action, { arg1: tag }, front, back));
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

  private parseGlVertexes(buf: ByteTools): { vertices: { x: number; y: number }[]; version: 2 | 5 } {
    if (buf.length < 4) return { vertices: [], version: 2 };
    const magic = buf.readUInt32();
    const version: 2 | 5 = magic === GL_VERT_MAGIC_V5 ? 5 : 2;
    if (magic !== GL_VERT_MAGIC_V2 && magic !== GL_VERT_MAGIC_V5) return { vertices: [], version: 2 };
    const out: { x: number; y: number }[] = [];
    while (buf.tell() + 8 <= buf.length) {
      out.push({ x: buf.readInt32() / 65536, y: buf.readInt32() / 65536 });
    }
    return { vertices: out, version };
  }

  private parseGlSegsAndSubsectors(
    glSegBuf: ByteTools,
    glSsectBuf: ByteTools,
    glVersion: 2 | 5
  ): { segs: Seg[]; subsectors: Subsector[] } {
    const numMapV = this.vertexes?.length ?? 0;
    const toUnified = (raw: number, isGl: boolean): number =>
      isGl ? numMapV + (raw & (glVersion === 5 ? 0x7fffffff : 0x7fff)) : (raw & (glVersion === 5 ? 0x7fffffff : 0x7fff));
    const vertIsGl = glVersion === 5 ? VERT_IS_GL_V5 : VERT_IS_GL_V1;

    const segs: Seg[] = [];
    if (glVersion === 5) {
      while (glSegBuf.tell() + 18 <= glSegBuf.length) {
        const startRaw = glSegBuf.readUInt32();
        const endRaw = glSegBuf.readUInt32();
        const linedef = glSegBuf.readUInt16();
        const side = glSegBuf.readUInt16();
        glSegBuf.readUInt32();
        const start = toUnified(startRaw, (startRaw & vertIsGl) !== 0);
        const end = toUnified(endRaw, (endRaw & vertIsGl) !== 0);
        segs.push(new Seg(this, segs.length, start, end, 0, linedef === 0xffff ? -1 : linedef, side, 0));
      }
    } else {
      while (glSegBuf.tell() + 12 <= glSegBuf.length) {
        const startRaw = glSegBuf.readUInt16();
        const endRaw = glSegBuf.readUInt16();
        const linedef = glSegBuf.readUInt16();
        const side = glSegBuf.readUInt16();
        glSegBuf.readUInt16();
        const start = toUnified(startRaw, (startRaw & vertIsGl) !== 0);
        const end = toUnified(endRaw, (endRaw & vertIsGl) !== 0);
        segs.push(new Seg(this, segs.length, start, end, 0, linedef === 0xffff ? -1 : linedef, side, 0));
      }
    }

    glSsectBuf.seek(0, 'START');
    const subsectors: Subsector[] = [];
    if (glVersion === 5) {
      for (let i = 0; glSsectBuf.tell() + 8 <= glSsectBuf.length; i++) {
        subsectors.push(new Subsector(this, i, glSsectBuf.readUInt32(), glSsectBuf.readUInt32()));
      }
    } else {
      for (let i = 0; glSsectBuf.tell() + 4 <= glSsectBuf.length; i++) {
        subsectors.push(new Subsector(this, i, glSsectBuf.readUInt16(), glSsectBuf.readUInt16()));
      }
    }
    return { segs, subsectors };
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
