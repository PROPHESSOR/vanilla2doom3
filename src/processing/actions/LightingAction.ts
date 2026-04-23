// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { MapParser } from '../../idTech1/MapParser';
import type { Doom3Map } from '../../idTech4/Doom3Map';
import type { Action } from '../Action';
import { mapX, mapY, mapZ } from '../../constants';

export interface LightingActionOptions {
  /**
   * Minimum light radius (for lightlevel 0).
   * Default: 64 - provides minimal ambient lighting to avoid pure black.
   */
  minRadius?: number;

  /**
   * Maximum light radius (for lightlevel 255).
   * Default: 800 - bright but not overwhelming.
   */
  maxRadius?: number;

  /**
   * Light color as RGB (0-1 range).
   * Default: [1, 0.95, 0.9] - neutral warm white.
   */
  color?: [number, number, number];

  /**
   * Use noshadows property to improve performance.
   * Default: true - recommended for many lights.
   */
  noShadows?: boolean;

  /**
   * Light intensity multiplier.
   * Values < 1 make lights dimmer, > 1 make them brighter.
   * Default: 1.0
   */
  intensityMultiplier?: number;

  /**
   * Vertical offset from sector mid-height (in Doom units, before scaling).
   * Default: 0
   */
  heightOffset?: number;

  /**
   * Only place lights in sectors with lightlevel above this threshold.
   * Useful to avoid placing lights in intentionally dark areas.
   * Default: 0 (place lights everywhere)
   */
  minLightLevel?: number;

  /**
   * Use quadratic falloff for better light distribution.
   * This requires specifying light_center property.
   * Default: false
   */
  useQuadraticFalloff?: boolean;
}

/**
 * LightingAction - Implements sector-based lighting for Doom 3 maps.
 *
 * This action places lights in each subsector based on the sector's lightlevel.
 * Each light is positioned at the centroid of the subsector polygon, at the
 * mid-height between floor and ceiling.
 *
 * Lighting Strategy:
 * - One light per subsector for even coverage
 * - Light radius scales with Doom lightlevel (0-255)
 * - Uses noshadows by default to avoid performance issues
 * - Neutral warm color for realistic indoor lighting
 *
 * To avoid overlighting:
 * - Light radius is carefully calibrated
 * - Intensity multiplier can be adjusted
 * - Minimum radius prevents pure darkness
 *
 * Performance:
 * - noshadows reduces GPU load significantly
 * - Lights are placed efficiently (one per subsector)
 * - Can filter out very dark sectors with minLightLevel
 */
export class LightingAction implements Action {
  name = 'LightingAction';

  private options: Required<LightingActionOptions>;
  private mapRef?: MapParser;

  constructor(options: LightingActionOptions = {}) {
    this.options = {
      minRadius: options.minRadius ?? 64,
      maxRadius: options.maxRadius ?? 800,
      color: options.color ?? [1, 0.95, 0.9],
      noShadows: options.noShadows ?? true,
      intensityMultiplier: options.intensityMultiplier ?? 1.0,
      heightOffset: options.heightOffset ?? 0,
      minLightLevel: options.minLightLevel ?? 0,
      useQuadraticFalloff: options.useQuadraticFalloff ?? false,
    };
  }

  postprocess(doom3Map: Doom3Map): void {
    if (!this.mapRef) {
      console.warn('[LightingAction] No map reference available for postprocess');
      return;
    }

    injectSectorLights(this.mapRef, doom3Map);
  }

  preprocess(map: MapParser): void {
    console.log('[LightingAction] Analyzing sectors for lighting...');

    // Store map reference for postprocess
    this.mapRef = map;

    const subsectors = map.subsectors ?? [];
    const sectors = map.sectors ?? [];

    if (subsectors.length === 0 || sectors.length === 0) {
      console.warn('[LightingAction] No subsectors or sectors found');
      return;
    }

    // Store light data in subsector metadata for postprocess
    let lightCount = 0;
    let skippedCount = 0;

    for (const subsector of subsectors) {
      const sectorIndex = subsector.sectorIndex;
      if (sectorIndex === undefined || sectorIndex >= sectors.length) {
        skippedCount++;
        continue;
      }

      const sector = sectors[sectorIndex];
      if (!sector) {
        skippedCount++;
        continue;
      }

      // Skip sectors with invalid geometry (ceiling at or below floor)
      if (sector.heightceiling <= sector.heightfloor) {
        console.warn(`[LightingAction] Skipping sector ${sectorIndex}: invalid geometry (ceiling ${sector.heightceiling} <= floor ${sector.heightfloor})`);
        skippedCount++;
        continue;
      }

      // Skip if below minimum light level threshold
      if (sector.lightlevel < this.options.minLightLevel) {
        console.log(`[LightingAction] Skipping sector ${sectorIndex} (lightlevel ${sector.lightlevel} < ${this.options.minLightLevel})`);
        skippedCount++;
        continue;
      }

      // Get subsector polygon points
      const points = subsector.getPolygonPoints();
      if (points.length < 3) {
        skippedCount++;
        continue; // Need at least a triangle
      }

      // Validate polygon points are not degenerate
      let validPolygon = true;
      for (const point of points) {
        if (!isFinite(point.x) || !isFinite(point.y)) {
          validPolygon = false;
          break;
        }
      }
      if (!validPolygon) {
        console.warn(`[LightingAction] Skipping subsector with invalid polygon points`);
        skippedCount++;
        continue;
      }

      // Calculate centroid
      const centroid = this.calculateCentroid(points);

      // Validate centroid
      if (!isFinite(centroid.x) || !isFinite(centroid.y)) {
        console.warn(`[LightingAction] Skipping subsector with invalid centroid`);
        skippedCount++;
        continue;
      }

      // Calculate mid-height
      const floor = sector.heightfloor;
      const ceiling = sector.heightceiling;
      const midHeight = (floor + ceiling) / 2 + this.options.heightOffset;

      // Calculate light radius based on sector lightlevel
      const lightRadius = this.calculateLightRadius(sector.lightlevel);

      // Store light data in metadata for use in postprocess
      if (!subsector.metadata.lighting) {
        subsector.metadata.lighting = [];
      }

      (subsector.metadata.lighting as Array<{
        x: number;
        y: number;
        z: number;
        radius: number;
        color: [number, number, number];
        noShadows: boolean;
        useQuadraticFalloff: boolean;
        sectorId: number;
        lightlevel: number;
      }>).push({
        x: centroid.x,
        y: centroid.y,
        z: midHeight,
        radius: lightRadius,
        color: this.options.color,
        noShadows: this.options.noShadows,
        useQuadraticFalloff: this.options.useQuadraticFalloff,
        sectorId: sectorIndex,
        lightlevel: sector.lightlevel,
      });

      lightCount++;
    }

    console.log(`[LightingAction] Prepared ${lightCount} lights for ${subsectors.length} subsectors (skipped ${skippedCount})`);

    // Store map reference in metadata for postprocess
    if (!map.metadata) {
      map.metadata = {};
    }
    map.metadata.lightingActionData = {
      subsectorsWithLights: subsectors.filter(ss => ss.metadata.lighting),
    };
  }

  /**
   * Calculate the centroid (center point) of a polygon.
   */
  private calculateCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
    let sumX = 0;
    let sumY = 0;

    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
    }

    return {
      x: sumX / points.length,
      y: sumY / points.length,
    };
  }

  /**
   * Calculate light radius based on Doom lightlevel (0-255).
   * Uses linear interpolation between minRadius and maxRadius.
   * Applies intensity multiplier.
   */
  private calculateLightRadius(lightlevel: number): number {
    // Normalize lightlevel to 0-1 range
    const normalized = Math.max(0, Math.min(255, lightlevel)) / 255;

    // Linear interpolation between min and max
    const baseRadius = this.options.minRadius + normalized * (this.options.maxRadius - this.options.minRadius);

    // Apply intensity multiplier
    return baseRadius * this.options.intensityMultiplier;
  }
}

/**
 * Helper function to inject light entities into Doom3Map after geometry is generated.
 * This should be called from a separate postprocess action that has access to both
 * the map data and the doom3Map.
 */
export function injectSectorLights(map: MapParser, doom3Map: Doom3Map): void {
  console.log('[LightingAction] Injecting sector lights into map...');

  const lightingData = map.metadata?.lightingActionData as {
    subsectorsWithLights: Array<{
      metadata: {
        lighting: Array<{
          x: number;
          y: number;
          z: number;
          radius: number;
          color: [number, number, number];
          noShadows: boolean;
          useQuadraticFalloff: boolean;
          sectorId: number;
          lightlevel: number;
        }>;
      };
    }>;
  };

  if (!lightingData?.subsectorsWithLights) {
    console.warn('[LightingAction] No lighting data found in map metadata');
    return;
  }

  let lightCount = 0;

  for (const subsector of lightingData.subsectorsWithLights) {
    const lights = subsector.metadata.lighting;
    if (!lights) continue;

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      if (!light) continue;

      // Convert coordinates to Doom 3 space
      const x = mapX(light.x);
      const y = mapY(light.y);
      const z = mapZ(light.z);
      const radius = light.radius; // Radius doesn't need COORD_SCALE as it's a distance in all directions

      const properties: Record<string, string> = {
        // Use global lightCount for unique names across all lights
        name: `light_ambient_${lightCount}`,
        origin: `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`,
        light_radius: `${radius} ${radius} ${radius}`,
        _color: `${light.color[0]} ${light.color[1]} ${light.color[2]}`,
      };

      if (light.noShadows) {
        properties.noshadows = '1';
      }

      if (light.useQuadraticFalloff) {
        properties.light_center = `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`;
      }

      doom3Map.addEntity({
        classname: 'light',
        properties,
        brushes: [],
      });

      lightCount++;
    }
  }

  console.log(`[LightingAction] Injected ${lightCount} sector lights`);
}
