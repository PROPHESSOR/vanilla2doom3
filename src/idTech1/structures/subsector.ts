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
    for (const seg of this.segs) {
      const ld = seg.linedefRef;
      if (!ld) continue;
      const sidedefIndex = seg.side === 0 ? ld.sidefront : ld.sideback;
      const side = this.map.sidedefs?.[sidedefIndex];
      if (side != null) return side.sector;
    }
    return undefined;
  }

  /** Ordered polygon points (GL: seg order; vanilla: use subsectorPolygonPoints in UI). */
  getPolygonPoints(): { x: number; y: number }[] {
    if (!this.map.useGlNodes) return [];
    const list = this.segs;
    const out: { x: number; y: number }[] = [];
    for (const seg of list) {
      out.push(this.map.getVertexForSeg(seg.startVertex));
    }
    return out;
  }
}
