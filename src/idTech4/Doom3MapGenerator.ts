// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { MapParser } from '../idTech1/MapParser';
import { polygonSlabBrush } from './polygonSlabBrush';
import { verticalWallBrush } from './verticalWallBrush';
import { rectBrush3d } from './rectBrush3d';

export interface Doom3MapOptions {
  /** Thickness of floor/ceiling slabs (default: 8) */
  slabThickness?: number;
  /** Width of wall brushes (default: 8) */
  wallWidth?: number;
  /** Expansion amount for subsector polygons to avoid gaps (default: 0.5) */
  polygonExpansion?: number;
  /** Add sealing box around level (default: true) */
  addSealingBox?: boolean;
  /** Margin for sealing box (default: 256) */
  sealingMargin?: number;
  /** Wall thickness for sealing box (default: 64) */
  sealingWallThickness?: number;
}

interface Bounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export function generateDoom3Map(map: MapParser, options: Doom3MapOptions = {}): string {
  const slabThickness = options.slabThickness ?? 8;
  const wallWidth = options.wallWidth ?? 8;
  const polygonExpansion = options.polygonExpansion ?? 0.5;
  const addSealingBox = options.addSealingBox ?? true;
  const sealingMargin = options.sealingMargin ?? 256;
  const sealingWallThickness = options.sealingWallThickness ?? 64;

  const brushes: string[] = [];
  const bounds: Bounds = {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };

  // Process subsectors for floors and ceilings
  console.log('Generating floors and ceilings from subsectors...');
  const subsectors = map.subsectors ?? [];
  const sectors = map.sectors ?? [];

  let processedSubsectors = 0;
  let skippedSubsectors = 0;

  for (const subsector of subsectors) {
    const polygon = subsector.getPolygonPoints();

    if (polygon.length < 3) {
      skippedSubsectors++;
      continue;
    }

    const sectorIndex = subsector.sectorIndex;
    if (sectorIndex === undefined || sectorIndex >= sectors.length) {
      skippedSubsectors++;
      continue;
    }

    const sector = sectors[sectorIndex];
    if (!sector) {
      skippedSubsectors++;
      continue;
    }

    const floor = sector.heightfloor;
    const ceiling = sector.heightceiling;

    if (ceiling <= floor) {
      skippedSubsectors++;
      continue;
    }

    // Floor slab (below floor level)
    const floorBrush = polygonSlabBrush(
      polygon,
      floor - slabThickness,
      slabThickness,
      {
        expandAmount: polygonExpansion,
        comment: `// Subsector ${subsector._id} floor (sector ${sectorIndex})`,
      }
    );

    if (floorBrush) {
      brushes.push(floorBrush);
    }

    // Ceiling slab (at ceiling level)
    const ceilingBrush = polygonSlabBrush(
      polygon,
      ceiling,
      slabThickness,
      {
        expandAmount: polygonExpansion,
        comment: `// Subsector ${subsector._id} ceiling (sector ${sectorIndex})`,
      }
    );

    if (ceilingBrush) {
      brushes.push(ceilingBrush);
    }

    // Update bounds
    for (const p of polygon) {
      bounds.minX = Math.min(bounds.minX, p.x);
      bounds.maxX = Math.max(bounds.maxX, p.x);
      bounds.minY = Math.min(bounds.minY, p.y);
      bounds.maxY = Math.max(bounds.maxY, p.y);
    }
    bounds.minZ = Math.min(bounds.minZ, floor);
    bounds.maxZ = Math.max(bounds.maxZ, ceiling);

    processedSubsectors++;
  }

  console.log(`Processed ${processedSubsectors} subsectors, skipped ${skippedSubsectors}`);

  // Process linedefs for walls
  console.log('Generating walls from linedefs...');
  const linedefs = map.linedefs ?? [];
  const sidedefs = map.sidedefs ?? [];
  const vertexes = map.vertexes ?? [];

  let wallCount = 0;

  for (const linedef of linedefs) {
    // Get vertex coordinates
    const v1Obj = vertexes[linedef.v1];
    const v2Obj = vertexes[linedef.v2];

    if (!v1Obj || !v2Obj) continue;

    const v1 = { x: parseFloat(v1Obj.x), y: parseFloat(v1Obj.y) };
    const v2 = { x: parseFloat(v2Obj.x), y: parseFloat(v2Obj.y) };

    // One-sided linedef: create full wall
    if (linedef.sideback < 0) {
      const sidefront = sidedefs[linedef.sidefront];
      if (!sidefront) continue;

      const sector = sectors[sidefront.sector];
      if (!sector) continue;

      const floor = sector.heightfloor;
      const ceiling = sector.heightceiling;

      if (ceiling > floor) {
        const wallBrush = verticalWallBrush(
          v1,
          v2,
          floor,
          ceiling,
          {
            width: wallWidth,
            comment: `// Linedef ${linedef._id} one-sided wall`,
          }
        );

        if (wallBrush) {
          brushes.push(wallBrush);
          wallCount++;
        }
      }
    } else {
      // Two-sided linedef: create gap walls
      const sidefront = sidedefs[linedef.sidefront];
      const sideback = sidedefs[linedef.sideback];

      if (!sidefront || !sideback) continue;

      const sectorFront = sectors[sidefront.sector];
      const sectorBack = sectors[sideback.sector];

      if (!sectorFront || !sectorBack) continue;

      const floor1 = sectorFront.heightfloor;
      const ceiling1 = sectorFront.heightceiling;
      const floor2 = sectorBack.heightfloor;
      const ceiling2 = sectorBack.heightceiling;

      // Lower wall if floors differ
      if (floor1 !== floor2) {
        const minFloor = Math.min(floor1, floor2);
        const maxFloor = Math.max(floor1, floor2);

        const lowerWallBrush = verticalWallBrush(
          v1,
          v2,
          minFloor,
          maxFloor,
          {
            width: wallWidth,
            comment: `// Linedef ${linedef._id} lower wall`,
          }
        );

        if (lowerWallBrush) {
          brushes.push(lowerWallBrush);
          wallCount++;
        }
      }

      // Upper wall if ceilings differ
      if (ceiling1 !== ceiling2) {
        const minCeiling = Math.min(ceiling1, ceiling2);
        const maxCeiling = Math.max(ceiling1, ceiling2);

        const upperWallBrush = verticalWallBrush(
          v1,
          v2,
          minCeiling,
          maxCeiling,
          {
            width: wallWidth,
            comment: `// Linedef ${linedef._id} upper wall`,
          }
        );

        if (upperWallBrush) {
          brushes.push(upperWallBrush);
          wallCount++;
        }
      }
    }
  }

  console.log(`Generated ${wallCount} wall brushes`);

  // Add sealing box if requested
  if (addSealingBox && isFinite(bounds.minX)) {
    console.log('Adding sealing box...');

    const boxMinX = bounds.minX - sealingMargin;
    const boxMinY = bounds.minY - sealingMargin;
    const boxMinZ = bounds.minZ - sealingMargin;
    const boxMaxX = bounds.maxX + sealingMargin;
    const boxMaxY = bounds.maxY + sealingMargin;
    const boxMaxZ = bounds.maxZ + sealingMargin;

    const boxWidth = boxMaxX - boxMinX;
    const boxHeight = boxMaxY - boxMinY;
    const boxDepth = boxMaxZ - boxMinZ;

    // West wall
    brushes.push(
      rectBrush3d(
        { x: boxMinX, y: boxMinY, z: boxMinZ },
        { width: sealingWallThickness, depth: boxHeight, height: boxDepth },
        { comment: '// Seal: West wall' }
      )
    );

    // East wall
    brushes.push(
      rectBrush3d(
        { x: boxMaxX - sealingWallThickness, y: boxMinY, z: boxMinZ },
        { width: sealingWallThickness, depth: boxHeight, height: boxDepth },
        { comment: '// Seal: East wall' }
      )
    );

    // South wall
    brushes.push(
      rectBrush3d(
        { x: boxMinX, y: boxMinY, z: boxMinZ },
        { width: boxWidth, depth: sealingWallThickness, height: boxDepth },
        { comment: '// Seal: South wall' }
      )
    );

    // North wall
    brushes.push(
      rectBrush3d(
        { x: boxMinX, y: boxMaxY - sealingWallThickness, z: boxMinZ },
        { width: boxWidth, depth: sealingWallThickness, height: boxDepth },
        { comment: '// Seal: North wall' }
      )
    );

    // Bottom
    brushes.push(
      rectBrush3d(
        { x: boxMinX, y: boxMinY, z: boxMinZ },
        { width: boxWidth, depth: boxHeight, height: sealingWallThickness },
        { comment: '// Seal: Bottom' }
      )
    );

    // Top
    brushes.push(
      rectBrush3d(
        { x: boxMinX, y: boxMinY, z: boxMaxZ - sealingWallThickness },
        { width: boxWidth, depth: boxHeight, height: sealingWallThickness },
        { comment: '// Seal: Top' }
      )
    );
  }

  // Find player start
  console.log('Finding player start...');
  const things = map.things ?? [];
  let playerX = 0;
  let playerY = 0;
  let playerZ = 16;

  for (const thing of things) {
    if (thing.type === 1) {
      // Player 1 start
      playerX = thing.x;
      playerY = thing.y;

      // Find sector at player position to get floor height
      // Simple approach: find first subsector that contains the player point
      for (const subsector of subsectors) {
        const polygon = subsector.getPolygonPoints();
        if (polygon.length >= 3 && pointInPolygon({ x: playerX, y: playerY }, polygon)) {
          const sectorIndex = subsector.sectorIndex;
          if (sectorIndex !== undefined && sectorIndex < sectors.length) {
            const sector = sectors[sectorIndex];
            if (sector) {
              playerZ = sector.heightfloor + 16;
              break;
            }
          }
        }
      }

      console.log(`Found player start at (${playerX}, ${playerY}, ${playerZ})`);
      break;
    }
  }

  // Generate map file
  const lines: string[] = [];
  lines.push('Version 2');
  lines.push('// entity 0');
  lines.push('{');
  lines.push('    "classname" "worldspawn"');

  // Add all brushes
  for (const brush of brushes) {
    if (brush && brush.trim()) {
      lines.push(brush);
    }
  }

  lines.push('}');

  // Player start entity
  lines.push('// entity 1');
  lines.push('{');
  lines.push('    "classname" "info_player_start"');
  lines.push('    "name" "info_player_start_1"');
  lines.push(`    "origin" "${playerX} ${playerY} ${playerZ}"`);
  lines.push('}');

  // Player light
  lines.push('// entity 2');
  lines.push('{');
  lines.push('    "classname" "light"');
  lines.push('    "name" "light_player"');
  lines.push('    "noshadows" "1"');
  lines.push('    "light_radius" "4096 4096 4096"');
  lines.push(`    "origin" "${playerX} ${playerY} ${playerZ + 64}"`);
  lines.push('}');

  // Fill light
  lines.push('// entity 3');
  lines.push('{');
  lines.push('    "classname" "light"');
  lines.push('    "name" "light_fill"');
  lines.push('    "noshadows" "1"');
  lines.push('    "light_radius" "4096 4096 4096"');
  lines.push(`    "origin" "${playerX} ${playerY} ${playerZ - 16}"`);
  lines.push('}');

  console.log(`Generated ${brushes.length} total brushes`);

  return lines.join('\n');
}

function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  const x = point.x;
  const y = point.y;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;

    const xi = pi.x;
    const yi = pi.y;
    const xj = pj.x;
    const yj = pj.y;

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}
