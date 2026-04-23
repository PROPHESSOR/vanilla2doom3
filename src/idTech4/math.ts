// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Plane {
  nx: number;
  ny: number;
  nz: number;
  d: number;
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = vec2Length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Direction(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

export function vec2Perpendicular(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}

export function vec2AngleDeg(v: Vec2): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

export function vec2Rotate(v: Vec2, degrees: number): Vec2 {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Create a plane from a normal vector and a point on the plane.
 * In idTech4: negative half-space is inside (solid), positive is outside (void).
 * Normals should point away from the brush interior (outward).
 */
export function planeFromNormalPoint(normal: Vec3, point: Vec3): Plane {
  const normalized = vec3Normalize(normal);
  const d = -(normalized.x * point.x + normalized.y * point.y + normalized.z * point.z);
  return {
    nx: normalized.x,
    ny: normalized.y,
    nz: normalized.z,
    d,
  };
}

/**
 * Create a plane from three points (counter-clockwise winding).
 */
export function planeFromPoints(p1: Vec3, p2: Vec3, p3: Vec3): Plane {
  const ab = vec3Sub(p2, p1);
  const ac = vec3Sub(p3, p1);
  const normal = vec3Cross(ab, ac);
  const len = vec3Length(normal);

  if (len === 0) {
    throw new Error('Cannot build plane from collinear points');
  }

  return planeFromNormalPoint(normal, p1);
}
