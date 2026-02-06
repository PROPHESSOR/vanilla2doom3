// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { MapParser } from '../../idTech1/MapParser';
import type { TextureSizeMap } from '../../idTech1/TextureSizes';
import type { Sector } from '../../idTech1/structures/sector';
import type { Doom3Map } from '../../idTech4/Doom3Map';
import type { Doom3Brush } from '../../idTech4/Doom3Map';
import { polygonSlabBrush } from '../../idTech4/polygonSlabBrush';
import type { Action } from '../Action';

// Classic Doom linedef specials that represent door actions
const DOOR_SPECIALS = new Set([
  1,   // DR Door Open Wait Close
  26,  // DR Door Blue Open Wait Close
  27,  // DR Door Yellow Open Wait Close
  28,  // DR Door Red Open Wait Close
  31,  // D1 Door Open Stay
  32,  // D1 Door Blue Open Stay
  33,  // D1 Door Red Open Stay
  34,  // D1 Door Yellow Open Stay
  117, // DR Door Blazing Open Wait Close
  118, // D1 Door Blazing Open Stay
]);

// Default open height for a door when original ceiling == floor
const DEFAULT_DOOR_OPEN_HEIGHT = 128;

const COORD_SCALE = 1.5;
const DEFAULT_WALL_SIZE = 128;

const mapX = (x: number) => x * COORD_SCALE;
const mapY = (y: number) => y * COORD_SCALE;
const mapZ = (z: number) => z * COORD_SCALE;

export interface DoorActionOptions {
  texturePrefix?: string;
  textureSizes?: TextureSizeMap;
}

export class DoorAction implements Action {
  name = 'DoorAction';

  private texturePrefix: string;
  private textureSizes: TextureSizeMap | undefined;

  constructor(options: DoorActionOptions = {}) {
    this.texturePrefix = options.texturePrefix ?? 'v2d3';
    this.textureSizes = options.textureSizes;
  }

  preprocess(map: MapParser): void {
    const linedefs = map.linedefs ?? [];
    const sidedefs = map.sidedefs ?? [];
    const sectors = map.sectors ?? [];

    for (const linedef of linedefs) {
      if (!DOOR_SPECIALS.has(linedef.special)) continue;

      // arg0 holds the sector tag (from classic Doom linedef tag field)
      const sectorTag = linedef.arg0;

      if (sectorTag === 0) {
        // Tag 0: mark the sector on the back side of this linedef
        if (linedef.sideback < 0) continue;
        const backSide = sidedefs[linedef.sideback];
        if (!backSide) continue;
        const sector = sectors[backSide.sector];
        if (sector) {
          this.markAsDoor(sector, sectors);
        }
      } else {
        // Tag != 0: mark all sectors with matching tag
        for (const sector of sectors) {
          if (sector.id === sectorTag) {
            this.markAsDoor(sector, sectors);
          }
        }
      }
    }
  }

  postprocess(doom3Map: Doom3Map): void {
    const ws = doom3Map.getWorldspawn();

    // Collect unique door sectors from worldspawn brushes
    const doorSectors = new Map<number, Sector>();
    for (const brush of ws.brushes) {
      const sector = brush.sourceSector;
      if (sector?.metadata.isDoor && !doorSectors.has(sector._id)) {
        doorSectors.set(sector._id, sector);
      }
    }

    // Build a func_door entity per door sector with a new full-height brush
    let doorIndex = 0;
    for (const [, sector] of doorSectors) {
      const brushes = this.buildDoorBrushes(sector);
      if (brushes.length === 0) continue;

      const entityName = `door_${doorIndex}`;
      doom3Map.addEntity({
        classname: 'func_door',
        properties: {
          name: entityName,
          model: entityName,
          lip: '8',
          movedir: '-1',
          speed: '100',
          wait: '3',
        },
        brushes,
      });
      doorIndex++;
    }

    if (doorIndex > 0) {
      console.log(`[DoorAction] Added ${doorIndex} func_door entities`);
    }
  }

  /** Generate full-height door brushes (floor to ceiling) from all subsectors of a door sector. */
  private buildDoorBrushes(sector: Sector): Doom3Brush[] {
    const map = sector.map;
    const subsectors = map.subsectors ?? [];
    const sectors = map.sectors ?? [];
    const brushes: Doom3Brush[] = [];

    const floor = mapZ(sector.heightfloor);
    const ceiling = mapZ(sector.heightceiling);
    const height = ceiling - floor;
    if (height <= 0) return brushes;

    // Find door texture from surrounding linedefs
    const doorTexName = this.findDoorTexture(sector);
    const doorTex = doorTexName ? `textures/${this.texturePrefix}/${doorTexName}` : undefined;
    const scales = this.doorTextureScales(doorTexName);

    for (const subsector of subsectors) {
      if (subsector.sectorIndex === undefined) continue;
      if (sectors[subsector.sectorIndex] !== sector) continue;

      const polygon = subsector.getPolygonPoints().map((p) => ({
        x: mapX(p.x),
        y: mapY(p.y),
      }));
      if (polygon.length < 3) continue;

      const text = polygonSlabBrush(polygon, floor, height, {
        expandAmount: 0.5,
        texture: doorTex,
        ...scales,
        comment: `// Door brush (sector ${sector._id}, subsector ${subsector._id})`,
      });
      if (text) {
        brushes.push({ text, sourceSector: sector });
      }
    }

    return brushes;
  }

  /** Find a suitable texture for the door brush from surrounding linedefs.
   *  Doors typically use the middle texture from sidedefs facing INTO the door sector. */
  private findDoorTexture(sector: Sector): string | null {
    const sectorLinedefs = sector.linedefs;
    const sidedefs = sector.map.sidedefs ?? [];

    // First pass: look for middle textures on sidedefs facing the door sector
    for (const ld of sectorLinedefs) {
      if (ld.sideback < 0) continue;

      for (const sideIdx of [ld.sidefront, ld.sideback]) {
        if (sideIdx < 0) continue;
        const side = sidedefs[sideIdx];
        if (!side || side.sector === sector._id) continue;

        // Middle texture is the door face texture
        const middle = side.texturemiddle.replace(/^"|"$/g, '').trim().toUpperCase();
        if (middle && middle !== '-') {
          console.log(`[DoorAction] Found door texture "${middle}" for sector ${sector._id}`);
          return middle;
        }
      }
    }

    // Fallback: try upper textures (door tracks)
    for (const ld of sectorLinedefs) {
      if (ld.sideback < 0) continue;
      for (const sideIdx of [ld.sidefront, ld.sideback]) {
        if (sideIdx < 0) continue;
        const side = sidedefs[sideIdx];
        if (!side || side.sector === sector._id) continue;
        const upper = side.texturetop.replace(/^"|"$/g, '').trim().toUpperCase();
        if (upper && upper !== '-') {
          console.log(`[DoorAction] Using upper texture "${upper}" as door texture for sector ${sector._id}`);
          return upper;
        }
      }
    }

    console.warn(`[DoorAction] No door texture found for sector ${sector._id}`);
    return null;
  }

  /** Compute UV scales for a door texture. */
  private doorTextureScales(texName: string | null): { textureScaleS: number; textureScaleT: number } {
    const dim = texName ? this.textureSizes?.get(texName) : undefined;
    const w = dim?.width ?? DEFAULT_WALL_SIZE;
    const h = dim?.height ?? DEFAULT_WALL_SIZE;
    return {
      textureScaleS: 1 / (w * COORD_SCALE),
      textureScaleT: 1 / (h * COORD_SCALE),
    };
  }

  private markAsDoor(sector: Sector, allSectors: Sector[]): void {
    if (sector.metadata.isDoor) return;

    sector.metadata.isDoor = true;
    sector.metadata.originalCeiling = sector.heightceiling;

    // If the door is closed (ceiling == floor), open it
    if (sector.heightceiling <= sector.heightfloor) {
      // Find a neighboring sector to determine open height
      const neighborCeiling = this.findNeighborCeiling(sector, allSectors);
      sector.heightceiling = neighborCeiling ?? (sector.heightfloor + DEFAULT_DOOR_OPEN_HEIGHT);
    }
  }

  /** Find the ceiling height of a neighboring non-door sector to use as open height. */
  private findNeighborCeiling(doorSector: Sector, allSectors: Sector[]): number | null {
    const sectorLinedefs = doorSector.linedefs;
    const sidedefs = doorSector.map.sidedefs ?? [];

    for (const ld of sectorLinedefs) {
      if (ld.sideback < 0) continue;

      // Check both sides for a sector that isn't this door sector
      const frontSide = sidedefs[ld.sidefront];
      const backSide = sidedefs[ld.sideback];

      for (const side of [frontSide, backSide]) {
        if (!side || side.sector === doorSector._id) continue;
        const neighbor = allSectors[side.sector];
        if (neighbor && !neighbor.metadata.isDoor) {
          return neighbor.heightceiling;
        }
      }
    }

    return null;
  }
}
