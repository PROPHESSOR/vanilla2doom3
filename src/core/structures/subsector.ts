/**
 * Copyright (c) 2026 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import type { MapParser } from '../MapParser';
import type { Seg } from './seg';

export class Subsector {
  declare _id: number;
  declare segCount: number;
  declare firstSeg: number;

  constructor(
    public map: MapParser,
    _id: number,
    segCount: number,
    firstSeg: number
  ) {
    this._id = _id;
    this.segCount = segCount;
    this.firstSeg = firstSeg;
  }

  get segs(): Seg[] {
    const list = this.map.segs ?? [];
    const out: Seg[] = [];
    for (let i = 0; i < this.segCount; i++) {
      const seg = list[this.firstSeg + i];
      if (seg) out.push(seg);
    }
    return out;
  }

  get sectorIndex(): number | undefined {
    const list = this.segs;
    const seg = list[0];
    if (!seg) return undefined;
    const ld = seg.linedefRef;
    if (!ld) return undefined;
    const sidedefIndex = seg.side === 0 ? ld.sidefront : ld.sideback;
    const side = this.map.sidedefs?.[sidedefIndex];
    return side?.sector;
  }
}
