// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { MapParser } from '../idTech1/MapParser';
import type { TextureSizeMap } from '../idTech1/TextureSizes';
import { polygonSlabBrush } from './polygonSlabBrush';
import { verticalWallBrush } from './verticalWallBrush';
import { rectBrush3d } from './rectBrush3d';
import { Doom3Map, type Doom3Brush } from './Doom3Map';

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
  /** Texture prefix for Doom 3 material paths, e.g. "v2d3" → "textures/v2d3/STONE1" */
  texturePrefix?: string;
  /** Texture name → dimensions from TEXTURE1/2; used for per-texture UV scale. */
  textureSizes?: TextureSizeMap;
}

interface Bounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

const mapX = (x: number) => x * 1.5;
const mapY = (y: number) => y * 1.5;
const mapZ = (z: number) => z * 1.5;

/**
 * Convert a Doom texture name to a Doom 3 material path.
 * Strips surrounding quotes (sidedefs store names as `"NAME"`).
 * Returns undefined for `-` or empty (= no texture).
 */
function mapTexture(raw: string, prefix: string): string | undefined {
  const name = raw.replace(/^"|"$/g, '').toUpperCase();
  if (!name || name === '-') return undefined;
  return `textures/${prefix}/${name}`;
}

// Texture UV scales: 1 texel = 1 Doom unit = 1.5 world units (mapX/Y/Z scale).
// scale = 1 / (texture_pixels * coordinate_scale)
const COORD_SCALE = 1.5;
const DEFAULT_FLAT_SIZE = 64;
const DEFAULT_WALL_SIZE = 128;

/**
 * Compute per-axis UV scale and offset for a texture.
 * Extracts the texture name from the full material path (textures/prefix/NAME).
 * offsetx/offsety are Doom sidedef pixel offsets (0 for floors/ceilings).
 */
function textureParams(
  materialPath: string | undefined,
  sizes: TextureSizeMap | undefined,
  defaultSize: number,
  offsetx = 0,
  offsety = 0,
): { textureScaleS: number; textureScaleT: number; textureOffsetS: number; textureOffsetT: number } {
  const texName = materialPath?.split('/').pop()?.toUpperCase();
  const dim = texName ? sizes?.get(texName) : undefined;
  const w = dim?.width ?? defaultSize;
  const h = dim?.height ?? defaultSize;
  // Doom offsets are in pixels. Convert to texture repeats (0-1 range).
  // The brushDef3 offset is in the same units as the scale, so we divide by texture size.
  return {
    textureScaleS: 1 / (w * COORD_SCALE),
    textureScaleT: 1 / (h * COORD_SCALE),
    textureOffsetS: offsetx / w,
    textureOffsetT: offsety / h,
  };
}

/** Check if a sector flat name is a sky texture (F_SKY1, SKY1, etc.). */
function isSkyFlat(texName: string): boolean {
  return texName.toUpperCase().replace(/^"|"$/g, '').includes('SKY');
}

export function generateDoom3Map(map: MapParser, options: Doom3MapOptions = {}): Doom3Map {
  const slabThickness = options.slabThickness ?? 8;
  const wallWidth = options.wallWidth ?? 8;
  const polygonExpansion = options.polygonExpansion ?? 0.5;
  const addSealingBox = options.addSealingBox ?? true;
  const sealingMargin = options.sealingMargin ?? 256;
  const sealingWallThickness = options.sealingWallThickness ?? 64;
  const texturePrefix = options.texturePrefix ?? 'v2d3';
  const texSizes = options.textureSizes;

  const doom3Map = new Doom3Map();
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
    const polygon = subsector.getPolygonPoints().map(p => ({ x: mapX(p.x), y: mapY(p.y) }));

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

    const floor = mapZ(sector.heightfloor);
    const ceiling = mapZ(sector.heightceiling);

    if (ceiling <= floor) {
      skippedSubsectors++;
      continue;
    }

    // Floor slab (below floor level)
    const floorTex = mapTexture(sector.texturefloor, texturePrefix);
    const floorBrushText = polygonSlabBrush(
      polygon,
      floor - slabThickness,
      slabThickness,
      {
        expandAmount: polygonExpansion,
        texture: floorTex,
        ...textureParams(floorTex, texSizes, DEFAULT_FLAT_SIZE),
        comment: `// Subsector ${subsector._id} floor (sector ${sectorIndex})`,
      }
    );

    if (floorBrushText) {
      const brush: Doom3Brush = { text: floorBrushText, sourceSector: sector };
      doom3Map.addBrushToWorldspawn(brush);
    }

    // Ceiling slab (at ceiling level)
    const ceilTex = mapTexture(sector.textureceiling, texturePrefix);
    const ceilingBrushText = polygonSlabBrush(
      polygon,
      ceiling,
      slabThickness,
      {
        expandAmount: polygonExpansion,
        texture: ceilTex,
        ...textureParams(ceilTex, texSizes, DEFAULT_FLAT_SIZE),
        comment: `// Subsector ${subsector._id} ceiling (sector ${sectorIndex})`,
      }
    );

    if (ceilingBrushText) {
      const brush: Doom3Brush = { text: ceilingBrushText, sourceSector: sector };
      doom3Map.addBrushToWorldspawn(brush);
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

    const v1 = { x: mapX(parseFloat(v1Obj.x)), y: mapY(parseFloat(v1Obj.y)) };
    const v2 = { x: mapX(parseFloat(v2Obj.x)), y: mapY(parseFloat(v2Obj.y)) };

    // One-sided linedef: create full wall
    if (linedef.sideback < 0) {
      const sidefront = sidedefs[linedef.sidefront];
      if (!sidefront) continue;

      const sector = sectors[sidefront.sector];
      if (!sector) continue;

      const floor = mapZ(sector.heightfloor);
      const ceiling = mapZ(sector.heightceiling);

      if (ceiling > floor) {
        const midTex = mapTexture(sidefront.texturemiddle, texturePrefix);
        const params = textureParams(midTex, texSizes, DEFAULT_WALL_SIZE, sidefront.offsetx, sidefront.offsety);
        if (sidefront.offsetx !== 0 || sidefront.offsety !== 0) {
          console.log(`[Doom3MapGenerator] Linedef ${linedef._id}: offsets (${sidefront.offsetx}, ${sidefront.offsety}) → UV (${params.textureOffsetS}, ${params.textureOffsetT})`);
        }
        const wallBrushText = verticalWallBrush(
          v1,
          v2,
          floor,
          ceiling,
          {
            width: wallWidth,
            texture: midTex,
            ...params,
            comment: `// Linedef ${linedef._id} one-sided wall`,
          }
        );

        if (wallBrushText) {
          const brush: Doom3Brush = { text: wallBrushText, sourceLinedef: linedef };
          doom3Map.addBrushToWorldspawn(brush);
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

      const floor1 = mapZ(sectorFront.heightfloor);
      const ceiling1 = mapZ(sectorFront.heightceiling);
      const floor2 = mapZ(sectorBack.heightfloor);
      const ceiling2 = mapZ(sectorBack.heightceiling);

      // Lower wall if floors differ
      if (floor1 !== floor2) {
        const minFloor = Math.min(floor1, floor2);
        const maxFloor = Math.max(floor1, floor2);

        // Lower texture: from the side whose sector has the higher floor
        const lowerSide = floor2 > floor1 ? sidefront : sideback;
        const lowerTex = mapTexture(lowerSide.texturebottom, texturePrefix);

        const lowerWallBrushText = verticalWallBrush(
          v1,
          v2,
          minFloor,
          maxFloor,
          {
            width: wallWidth,
            texture: lowerTex,
            ...textureParams(lowerTex, texSizes, DEFAULT_WALL_SIZE, lowerSide.offsetx, lowerSide.offsety),
            comment: `// Linedef ${linedef._id} lower wall`,
          }
        );

        if (lowerWallBrushText) {
          const brush: Doom3Brush = { text: lowerWallBrushText, sourceLinedef: linedef };
          doom3Map.addBrushToWorldspawn(brush);
          wallCount++;
        }
      }

      // Upper wall if ceilings differ
      if (ceiling1 !== ceiling2) {
        const minCeiling = Math.min(ceiling1, ceiling2);
        const maxCeiling = Math.max(ceiling1, ceiling2);

        // Upper texture: from the side whose sector has the higher ceiling
        const upperSide = ceiling2 < ceiling1 ? sidefront : sideback;
        let upperTex = mapTexture(upperSide.texturetop, texturePrefix);

        // Fallback: if no upper texture and either sector has sky ceiling, use sky flat
        if (!upperTex) {
          const frontIsSky = isSkyFlat(sectorFront.textureceiling);
          const backIsSky = isSkyFlat(sectorBack.textureceiling);
          if (frontIsSky || backIsSky) {
            const skySector = frontIsSky ? sectorFront : sectorBack;
            upperTex = mapTexture(skySector.textureceiling, texturePrefix);
            console.log(`[Doom3MapGenerator] Using sky texture "${skySector.textureceiling}" for upper wall (linedef ${linedef._id})`);
          }
        }

        // Use offset 0 for sky textures (they don't need offsets)
        const useSkyTex = !mapTexture(upperSide.texturetop, texturePrefix) && (isSkyFlat(sectorFront.textureceiling) || isSkyFlat(sectorBack.textureceiling));
        const upperParams = textureParams(
          upperTex,
          texSizes,
          DEFAULT_WALL_SIZE,
          useSkyTex ? 0 : upperSide.offsetx,
          useSkyTex ? 0 : upperSide.offsety
        );

        const upperWallBrushText = verticalWallBrush(
          v1,
          v2,
          minCeiling,
          maxCeiling,
          {
            width: wallWidth,
            texture: upperTex,
            ...upperParams,
            comment: `// Linedef ${linedef._id} upper wall`,
          }
        );

        if (upperWallBrushText) {
          const brush: Doom3Brush = { text: upperWallBrushText, sourceLinedef: linedef };
          doom3Map.addBrushToWorldspawn(brush);
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

    // Sealing box brushes (no source sector/linedef)
    doom3Map.addBrushToWorldspawn({
      text: rectBrush3d(
        { x: boxMinX, y: boxMinY, z: boxMinZ },
        { width: sealingWallThickness, depth: boxHeight, height: boxDepth },
        { comment: '// Seal: West wall' }
      ),
    });
    doom3Map.addBrushToWorldspawn({
      text: rectBrush3d(
        { x: boxMaxX - sealingWallThickness, y: boxMinY, z: boxMinZ },
        { width: sealingWallThickness, depth: boxHeight, height: boxDepth },
        { comment: '// Seal: East wall' }
      ),
    });
    doom3Map.addBrushToWorldspawn({
      text: rectBrush3d(
        { x: boxMinX, y: boxMinY, z: boxMinZ },
        { width: boxWidth, depth: sealingWallThickness, height: boxDepth },
        { comment: '// Seal: South wall' }
      ),
    });
    doom3Map.addBrushToWorldspawn({
      text: rectBrush3d(
        { x: boxMinX, y: boxMaxY - sealingWallThickness, z: boxMinZ },
        { width: boxWidth, depth: sealingWallThickness, height: boxDepth },
        { comment: '// Seal: North wall' }
      ),
    });
    doom3Map.addBrushToWorldspawn({
      text: rectBrush3d(
        { x: boxMinX, y: boxMinY, z: boxMinZ },
        { width: boxWidth, depth: boxHeight, height: sealingWallThickness },
        { comment: '// Seal: Bottom' }
      ),
    });
    doom3Map.addBrushToWorldspawn({
      text: rectBrush3d(
        { x: boxMinX, y: boxMinY, z: boxMaxZ - sealingWallThickness },
        { width: boxWidth, depth: boxHeight, height: sealingWallThickness },
        { comment: '// Seal: Top' }
      ),
    });
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
      playerX = mapX(thing.x);
      playerY = mapY(thing.y);

      // Find sector at player position to get floor height
      for (const subsector of subsectors) {
        const polygon = subsector.getPolygonPoints().map(p => ({ x: mapX(p.x), y: mapY(p.y) }));
        if (polygon.length >= 3 && pointInPolygon({ x: playerX, y: playerY }, polygon)) {
          const sectorIndex = subsector.sectorIndex;
          if (sectorIndex !== undefined && sectorIndex < sectors.length) {
            const sector = sectors[sectorIndex];
            if (sector) {
              playerZ = mapZ(sector.heightfloor) + 0;
              break;
            }
          }
        }
      }

      console.log(`Found player start at (${playerX}, ${playerY}, ${playerZ})`);
      break;
    }
  }

  // Player start entity
  doom3Map.addEntity({
    classname: 'info_player_start',
    properties: {
      name: 'info_player_start_1',
      origin: `${playerX} ${playerY} ${playerZ}`,
    },
    brushes: [],
  });

  // Player light
  doom3Map.addEntity({
    classname: 'light',
    properties: {
      name: 'light_player',
      noshadows: '1',
      light_radius: '4096 4096 4096',
      origin: `${playerX} ${playerY} ${playerZ + 64}`,
    },
    brushes: [],
  });

  // Fill light
  doom3Map.addEntity({
    classname: 'light',
    properties: {
      name: 'light_fill',
      noshadows: '1',
      light_radius: '4096 4096 4096',
      origin: `${playerX} ${playerY} ${playerZ - 16}`,
    },
    brushes: [],
  });

  const ws = doom3Map.getWorldspawn();
  console.log(`Generated ${ws.brushes.length} total brushes`);

  return doom3Map;
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
