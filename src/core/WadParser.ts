/**
 * Copyright (c) 2022 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import ByteTools from './utils/ByteTools';
import { setImmediate } from './utils';

const NOT_PARSED_ERROR = 'Lumps not parsed';

export class WadLump {

  public wadBuffer: ByteTools;
  public pos: number;
  public size: number;
  public name: string;
  public index: number;

  constructor(wadBuffer: ByteTools, pos: number, size: number, name: string, index: number) {
    this.wadBuffer = wadBuffer;
    this.pos = pos;
    this.size = size;
    this.name = name;
    this.index = index;
  }

  read() {
    return new ByteTools(new DataView(
      this.wadBuffer.buffer.buffer.slice(this.pos, this.pos + this.size),
    ));
  }
}

export class WadParser {
  private buffer: ByteTools;
  private type: string | null = null;
  private lumps: WadLump[] | null = null;

  constructor(buffer: ByteTools) {
    this.buffer = buffer;
  }

  async parse() {
    const type = this.buffer.readString(4);

    if (!['IWAD', 'PWAD'].includes(type)) throw new Error('Not a WAD file!');

    this.type = type;

    const numLumps = this.buffer.readUInt32();

    console.log(`Wad contains ${numLumps} lumps`);

    const dirTableOffset = this.buffer.readUInt32();

    console.log(`Wad table offset: ${dirTableOffset}`);

    this.buffer.seek(dirTableOffset, 'START');

    this.lumps = [];

    for (let i = 0; i < numLumps; i++) {
      const start = this.buffer.readUInt32();
      const size = this.buffer.readUInt32();
      const name = this.buffer.readString(8);

      this.lumps.push(new WadLump(this.buffer, start, size, name, i));
    }

    console.log(`Parsed ${this.lumps.length} lumps`);

    await setImmediate();
  }

  static getLumpsByName(lumps: WadLump[], name: string) {
    return lumps.filter((x) => x.name === name);
  }

  getLumpsByName(name: string): WadLump[] {
    if (!this.lumps) throw new Error(NOT_PARSED_ERROR);
    return WadParser.getLumpsByName(this.lumps, name);
  }

  getMaps() {
    const REGEXP_MAP = /^(MAP\d+)|(E\dM\d)$/;

    if (!this.lumps) throw new Error(NOT_PARSED_ERROR);

    return this.lumps.filter((x) => REGEXP_MAP.test(x.name));
  }

  getMapLumps(index: number) {
    if (!this.lumps) throw new Error(NOT_PARSED_ERROR);

    const slice = this.lumps.slice(index);

    const [THINGS] = WadParser.getLumpsByName(slice, 'THINGS');
    const [LINEDEFS] = WadParser.getLumpsByName(slice, 'LINEDEFS');
    const [SIDEDEFS] = WadParser.getLumpsByName(slice, 'SIDEDEFS');
    const [VERTEXES] = WadParser.getLumpsByName(slice, 'VERTEXES');
    const [SECTORS] = WadParser.getLumpsByName(slice, 'SECTORS');
    const [SEGS] = WadParser.getLumpsByName(slice, 'SEGS');
    const [SSECTORS] = WadParser.getLumpsByName(slice, 'SSECTORS');

    return {
      THINGS,
      LINEDEFS,
      SIDEDEFS,
      VERTEXES,
      SECTORS,
      SEGS,
      SSECTORS,
    };
  }
}
