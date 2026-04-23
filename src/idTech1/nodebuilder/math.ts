/**
 * Math utilities for node builder
 */

/**
 * Compute angle of line from (0,0) to (dx,dy).
 * Result is degrees, where 0 is east and 90 is north.
 */
export function computeAngle(dx: number, dy: number): number {
  if (dx === 0) {
    return dy > 0 ? 90.0 : 270.0;
  }

  let angle = (Math.atan2(dy, dx) * 180.0) / Math.PI;

  if (angle < 0) {
    angle += 360.0;
  }

  return angle;
}

/**
 * Round to nearest integer
 */
export function iRound(x: number): number {
  return Math.round(x);
}
