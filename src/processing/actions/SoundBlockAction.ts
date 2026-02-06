// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { MapParser } from '../../idTech1/MapParser';
import type { Doom3Map, Doom3Brush } from '../../idTech4/Doom3Map';
import type { Action } from '../Action';
import { mapX, mapY, mapZ } from '../../constants';
import { verticalWallBrush } from '../../idTech4/verticalWallBrush';

export class SoundBlockAction implements Action {
  name = 'SoundBlockAction';

  postprocess(doom3Map: Doom3Map): void {
    const ws = doom3Map.getWorldspawn();

    // We need access to the original MapParser instance
    // Get it from the first brush's sector if available
    let mapParser: MapParser | undefined;
    for (const brush of ws.brushes) {
      if (brush.sourceSector) {
        mapParser = brush.sourceSector.map;
        break;
      }
    }

    if (!mapParser) {
      console.warn('[SoundBlockAction] No MapParser instance found, skipping sound block conversion');
      return;
    }

    const linedefs = mapParser.linedefs ?? [];
    const sidedefs = mapParser.sidedefs ?? [];
    const sectors = mapParser.sectors ?? [];
    const brushes: Doom3Brush[] = [];

    for (const linedef of linedefs) {
      // Check if linedef has blocksound flag
      const blocksSound = (linedef as unknown as Record<string, unknown>).blocksound === true;
      if (!blocksSound) continue;

      // Only process two-sided lines (sound blocking doesn't make sense on one-sided)
      if (linedef.sideback < 0) continue;

      const v1 = linedef.vertex1;
      const v2 = linedef.vertex2;
      if (!v1 || !v2) continue;

      const frontSide = sidedefs[linedef.sidefront];
      const backSide = sidedefs[linedef.sideback];
      if (!frontSide || !backSide) continue;

      const frontSector = sectors[frontSide.sector];
      const backSector = sectors[backSide.sector];
      if (!frontSector || !backSector) continue;

      // Create a vertical portal from the lowest floor to the highest ceiling
      const minFloor = Math.min(frontSector.heightfloor, backSector.heightfloor);
      const maxCeiling = Math.max(frontSector.heightceiling, backSector.heightceiling);

      const floor = mapZ(minFloor);
      const height = mapZ(maxCeiling - minFloor);

      if (height <= 0) continue;

      // Create a very thin portal brush along the linedef
      const x1 = mapX(parseFloat(v1.x));
      const y1 = mapY(parseFloat(v1.y));
      const x2 = mapX(parseFloat(v2.x));
      const y2 = mapY(parseFloat(v2.y));

      const text = verticalWallBrush(
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        floor,
        height,
        {
          width: 0.1,
          texture: 'textures/editor/visportal',
          textureScaleS: 1,
          textureScaleT: 1,
          comment: `// Sound blocking portal (linedef ${linedef._id})`,
        }
      );

      if (text) {
        brushes.push({ text, sourceLinedef: linedef });
      }
    }

    if (brushes.length > 0) {
      doom3Map.addEntity({
        classname: 'func_portal',
        properties: {
          nosound: '1',
        },
        brushes,
      });

      console.log(`[SoundBlockAction] Added sound blocking portals for ${brushes.length} linedefs`);
    }
  }
}
