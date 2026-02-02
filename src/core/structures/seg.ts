/**
 * Copyright (c) 2026 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import type { MapParser } from '../MapParser';
import type { Vertex } from './vertex';
import type { Linedef } from './linedef';

export class Seg {
  declare _id: number;
  declare startVertex: number;
  declare endVertex: number;
  declare angle: number;
  declare linedef: number;
  declare side: number;
  declare offset: number;

  constructor(
    public map: MapParser,
    _id: number,
    startVertex: number,
    endVertex: number,
    angle: number,
    linedef: number,
    side: number,
    offset: number
  ) {
    this._id = _id;
    this.startVertex = startVertex;
    this.endVertex = endVertex;
    this.angle = angle;
    this.linedef = linedef;
    this.side = side;
    this.offset = offset;
  }

  get vertex1(): Vertex | undefined {
    return this.map.vertexes?.[this.startVertex];
  }

  get vertex2(): Vertex | undefined {
    return this.map.vertexes?.[this.endVertex];
  }

  get linedefRef(): Linedef | undefined {
    return this.map.linedefs?.[this.linedef];
  }
}
