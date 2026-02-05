// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Sector } from '../idTech1/structures/sector';
import type { Linedef } from '../idTech1/structures/linedef';

export interface Doom3Brush {
  /** Raw brush text (the brushDef3 block including comment and braces) */
  text: string;
  /** Set when the brush originates from a sector segment (floor/ceiling) */
  sourceSector?: Sector;
  /** Set when the brush originates from a linedef (wall) */
  sourceLinedef?: Linedef;
}

export interface Doom3Entity {
  classname: string;
  properties: Record<string, string>;
  brushes: Doom3Brush[];
}

export class Doom3Map {
  entities: Doom3Entity[] = [];

  addEntity(entity: Doom3Entity): number {
    this.entities.push(entity);
    return this.entities.length - 1;
  }

  getWorldspawn(): Doom3Entity {
    let ws = this.entities.find((e) => e.classname === 'worldspawn');
    if (!ws) {
      ws = { classname: 'worldspawn', properties: {}, brushes: [] };
      this.entities.unshift(ws);
    }
    return ws;
  }

  addBrushToWorldspawn(brush: Doom3Brush): void {
    this.getWorldspawn().brushes.push(brush);
  }

  export(): string {
    const lines: string[] = [];
    lines.push('Version 2');

    for (let i = 0; i < this.entities.length; i++) {
      const entity = this.entities[i]!;
      lines.push(`// entity ${i}`);
      lines.push('{');
      lines.push(`    "classname" "${entity.classname}"`);

      for (const [key, value] of Object.entries(entity.properties)) {
        lines.push(`    "${key}" "${value}"`);
      }

      for (const brush of entity.brushes) {
        if (brush.text && brush.text.trim()) {
          lines.push(brush.text);
        }
      }

      lines.push('}');
    }

    return lines.join('\n');
  }
}
