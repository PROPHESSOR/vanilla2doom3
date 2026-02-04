/**
 * Preprocessing: vertex/linedef overlaps and wall tips
 */

import { Vertex, Linedef, WallTip } from './types';
import { computeAngle } from './math';
import { DIST_EPSILON, ANG_EPSILON } from './constants';

export function addWallTip(
  vertex: Vertex,
  dx: number,
  dy: number,
  open_left: boolean,
  open_right: boolean
): void {
  if (vertex.overlap !== null) {
    throw new Error('Cannot add wall tip to overlapping vertex');
  }

  const tip = new WallTip();
  tip.angle = computeAngle(dx, dy);
  tip.open_left = open_left;
  tip.open_right = open_right;

  // Find the correct place (order is increasing angle)
  let after: WallTip | null = vertex.tip_set;
  while (after && after.next) {
    after = after.next;
  }

  while (after && tip.angle + ANG_EPSILON < after.angle) {
    after = after.prev;
  }

  // Link it in
  tip.next = after ? after.next : vertex.tip_set;
  tip.prev = after;

  if (after) {
    if (after.next) {
      after.next.prev = tip;
    }
    after.next = tip;
  } else {
    if (vertex.tip_set !== null) {
      vertex.tip_set.prev = tip;
    }
    vertex.tip_set = tip;
  }
}

export function checkOpen(vertex: Vertex, dx: number, dy: number): boolean {
  const angle = computeAngle(dx, dy);

  // First check whether there's a wall-tip that lies in the exact
  // direction of the given direction
  for (let tip = vertex.tip_set; tip; tip = tip.next) {
    if (
      Math.abs(tip.angle - angle) < ANG_EPSILON ||
      Math.abs(tip.angle - angle) > 360.0 - ANG_EPSILON
    ) {
      // Found one, hence closed
      return false;
    }
  }

  // Find the first wall-tip whose angle is greater than the angle we're interested in
  for (let tip = vertex.tip_set; tip; tip = tip.next) {
    if (angle + ANG_EPSILON < tip.angle) {
      // We're on the RIGHT side of that wall-tip
      return tip.open_right;
    }

    if (!tip.next) {
      // No more tips, thus we must be on the LEFT side of the tip
      // with the largest angle
      return tip.open_left;
    }
  }

  // Usually won't get here
  return true;
}

export function detectOverlappingVertices(vertices: Vertex[], linedefs: Linedef[]): void {
  if (vertices.length < 2) {
    return;
  }

  // Sort vertices by increasing X coordinate
  const sorted = [...vertices].sort((a, b) => a.x - b.x);

  // Mark overlapping vertices
  for (let i = 0; i < sorted.length - 1; i++) {
    const A = sorted[i]!;

    for (let k = i + 1; k < sorted.length; k++) {
      const B = sorted[k]!;

      if (B.x > A.x + DIST_EPSILON) {
        break;
      }

      if (A.overlaps(B)) {
        // Found an overlap - chain to the canonical vertex
        B.overlap = A.overlap || A;
      }
    }
  }

  // Update linedefs to use canonical vertices
  for (const L of linedefs) {
    while (L.start.overlap) {
      L.start = L.start.overlap;
    }
    while (L.end.overlap) {
      L.end = L.end.overlap;
    }
  }
}

export function detectOverlappingLines(linedefs: Linedef[]): void {
  // Sort all lines by minimum X coordinate
  const sorted = [...linedefs].sort((a, b) => a.minX() - b.minX());

  for (let i = 0; i < sorted.length - 1; i++) {
    const A = sorted[i]!;

    for (let k = i + 1; k < sorted.length; k++) {
      const B = sorted[k]!;

      if (B.minX() > A.minX() + DIST_EPSILON) {
        break;
      }

      // Due to detectOverlappingVertices, we can compare vertex pointers
      const over1 = A.start === B.start && A.end === B.end;
      const over2 = A.start === B.end && A.end === B.start;

      if (over1 || over2) {
        // Found an overlap - keep the lowest numbered one
        if (A.index < B.index) {
          A.overlap = B.overlap || B;
        } else {
          B.overlap = A.overlap || A;
        }
      }
    }
  }
}

export function calculateWallTips(linedefs: Linedef[]): void {
  for (const L of linedefs) {
    if (L.overlap || L.zero_len) {
      continue;
    }

    const x1 = L.start.x;
    const y1 = L.start.y;
    const x2 = L.end.x;
    const y2 = L.end.y;

    const left = L.left !== null && L.left.sector >= 0;
    const right = L.right !== null && L.right.sector >= 0;

    addWallTip(L.start, x2 - x1, y2 - y1, left, right);
    addWallTip(L.end, x1 - x2, y1 - y2, right, left);
  }
}
