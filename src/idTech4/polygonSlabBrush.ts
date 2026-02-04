// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Vec2, Plane } from './math';
import { planeFromNormalPoint } from './math';
import { brushDef3, type BrushDef3Options } from './brushDef3';

export interface PolygonSlabBrushOptions extends BrushDef3Options {
  expandAmount?: number;
}

/**
 * Generate a slab brush (horizontal polygon with height) using cutting planes.
 * Creates a rectangular brush with cutting planes for each edge to match polygon boundary.
 */
export function polygonSlabBrush(
  polygon: Vec2[],
  zBottom: number,
  height: number,
  options: PolygonSlabBrushOptions = {}
): string {
  if (polygon.length < 3) {
    console.warn('polygonSlabBrush: polygon has < 3 vertices, skipping');
    return '';
  }

  if (height <= 0) {
    console.warn(`polygonSlabBrush: invalid height ${height}, skipping`);
    return '';
  }

  // Optional expansion to avoid gaps between adjacent polygons
  const expandAmount = options.expandAmount ?? 0;
  let processedPolygon = polygon;

  if (expandAmount > 0) {
    processedPolygon = expandPolygon(polygon, expandAmount);
  }

  // Calculate polygon area to determine winding order
  let area = 0;
  for (let i = 0; i < processedPolygon.length; i++) {
    const p1 = processedPolygon[i];
    const p2 = processedPolygon[(i + 1) % processedPolygon.length];
    if (!p1 || !p2) continue;
    area += p1.x * p2.y - p2.x * p1.y;
  }
  area = area / 2;

  if (area === 0) {
    console.warn('polygonSlabBrush: degenerate polygon (zero area), skipping');
    return '';
  }

  // Calculate centroid for normal direction verification
  const cx = processedPolygon.reduce((sum, p) => sum + p.x, 0) / processedPolygon.length;
  const cy = processedPolygon.reduce((sum, p) => sum + p.y, 0) / processedPolygon.length;

  // Bottom and top planes
  const firstPoint = processedPolygon[0];
  if (!firstPoint) {
    console.warn('polygonSlabBrush: invalid polygon (no first point), skipping');
    return '';
  }

  const bottomPlane = planeFromNormalPoint(
    { x: 0, y: 0, z: -1 },
    { x: firstPoint.x, y: firstPoint.y, z: zBottom }
  );
  const topPlane = planeFromNormalPoint(
    { x: 0, y: 0, z: 1 },
    { x: firstPoint.x, y: firstPoint.y, z: zBottom + height }
  );

  const planes: Plane[] = [bottomPlane, topPlane];
  const seenPlanes = new Set<string>();

  // Track bottom/top planes in deduplication set
  seenPlanes.add(planeKey(bottomPlane));
  seenPlanes.add(planeKey(topPlane));

  // Add cutting planes for each edge
  for (let i = 0; i < processedPolygon.length; i++) {
    const p1 = processedPolygon[i];
    const p2 = processedPolygon[(i + 1) % processedPolygon.length];

    if (!p1 || !p2) continue;

    // Edge vector
    const ex = p2.x - p1.x;
    const ey = p2.y - p1.y;

    // Outward normal (perpendicular to edge, pointing away from solid)
    let nx: number, ny: number;
    if (area >= 0) {
      // CCW winding: rotate 90° counterclockwise to get outward normal
      nx = -ey;
      ny = ex;
    } else {
      // CW winding: rotate 90° clockwise to get outward normal
      nx = ey;
      ny = -ex;
    }

    const length = Math.sqrt(nx * nx + ny * ny);
    if (length > 0) {
      nx /= length;
      ny /= length;
    }

    // Verify normal points outward from centroid
    const edgeMidx = (p1.x + p2.x) / 2;
    const edgeMidy = (p1.y + p2.y) / 2;
    const toCenterX = cx - edgeMidx;
    const toCenterY = cy - edgeMidy;
    const dot = nx * toCenterX + ny * toCenterY;

    // If dot product is positive, normal points toward center (inward), so flip it
    if (dot > 0) {
      nx = -nx;
      ny = -ny;
    }

    // Create cutting plane
    const cutPlane = planeFromNormalPoint(
      { x: nx, y: ny, z: 0 },
      { x: p1.x, y: p1.y, z: zBottom }
    );

    // Deduplicate planes
    const key = planeKey(cutPlane);
    if (!seenPlanes.has(key)) {
      planes.push(cutPlane);
      seenPlanes.add(key);
    }
  }

  if (planes.length < 4) {
    console.warn(`polygonSlabBrush: only ${planes.length} planes, need at least 4, skipping`);
    return '';
  }

  return brushDef3(planes, options);
}

function planeKey(plane: Plane): string {
  return `${plane.nx.toFixed(5)},${plane.ny.toFixed(5)},${plane.nz.toFixed(5)},${plane.d.toFixed(1)}`;
}

function expandPolygon(polygon: Vec2[], amount: number): Vec2[] {
  // Calculate centroid
  const cx = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
  const cy = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;

  // Push each vertex outward from centroid
  return polygon.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.001) {
      return p;
    }

    const nx = dx / dist;
    const ny = dy / dist;

    return {
      x: p.x + nx * amount,
      y: p.y + ny * amount,
    };
  });
}
