/**
 * Seg creation and manipulation
 */

import { Seg, Linedef, Vertex, Sidedef, Bbox, Intersection, QuadTree } from './types';
import { addWallTip, checkOpen } from './preprocess';
import { DIST_EPSILON } from './constants';

export function listAddSeg(list: Seg | null, seg: Seg | null): Seg | null {
  if (seg === null) return list;
  seg.next = list;
  return seg;
}

export function createOneSeg(
  line: Linedef,
  start: Vertex,
  end: Vertex,
  side: Sidedef,
  what_side: number
): Seg {
  // Handle overlapping vertices
  if (start.overlap) start = start.overlap;
  if (end.overlap) end = end.overlap;

  const seg = new Seg(start, end, line, what_side);
  seg.partner = null;
  seg.source_line = seg.linedef;
  seg.index = -1;

  seg.recompute();

  return seg;
}

export function createSegs(linedefs: Linedef[]): Seg | null {
  let list: Seg | null = null;

  for (const line of linedefs) {
    let left: Seg | null = null;
    let right: Seg | null = null;

    // Ignore zero-length lines
    if (line.zero_len) {
      continue;
    }

    // Ignore overlapping lines
    if (line.overlap !== null) {
      continue;
    }

    if (line.right !== null) {
      right = createOneSeg(line, line.start, line.end, line.right, 0);
      list = listAddSeg(list, right);
    }

    if (line.left !== null) {
      const leftSeg = createOneSeg(line, line.end, line.start, line.left, 1);
      list = listAddSeg(list, leftSeg);
      left = leftSeg;

      if (right !== null) {
        // Partner segs
        left.partner = right;
        right.partner = left;
      }
    }
  }

  return list;
}

export function findLimits2(list: Seg | null, bbox: Bbox): void {
  // Empty list
  if (list === null) {
    bbox.minx = 0;
    bbox.miny = 0;
    bbox.maxx = 4;
    bbox.maxy = 4;
    return;
  }

  bbox.minx = bbox.miny = 32767;
  bbox.maxx = bbox.maxy = -32768;

  for (let seg: Seg | null = list; seg !== null; seg = seg.next) {
    const x1 = seg.start.x;
    const y1 = seg.start.y;
    const x2 = seg.end.x;
    const y2 = seg.end.y;

    const lx = Math.floor(Math.min(x1, x2) - 0.2);
    const ly = Math.floor(Math.min(y1, y2) - 0.2);
    const hx = Math.ceil(Math.max(x1, x2) + 0.2);
    const hy = Math.ceil(Math.max(y1, y2) + 0.2);

    if (lx < bbox.minx) bbox.minx = lx;
    if (ly < bbox.miny) bbox.miny = ly;
    if (hx > bbox.maxx) bbox.maxx = hx;
    if (hy > bbox.maxy) bbox.maxy = hy;
  }
}

export function computeIntersection(
  seg: Seg,
  part: Seg,
  perp_c: number,
  perp_d: number
): { x: number; y: number } {
  // Horizontal partition against vertical seg
  if (part.pdy === 0 && seg.pdx === 0) {
    return { x: seg.psx, y: part.psy };
  }

  // Vertical partition against horizontal seg
  if (part.pdx === 0 && seg.pdy === 0) {
    return { x: part.psx, y: seg.psy };
  }

  // 0 = start, 1 = end
  const ds = perp_c / (perp_c - perp_d);

  const x = seg.pdx === 0 ? seg.psx : seg.psx + seg.pdx * ds;
  const y = seg.pdy === 0 ? seg.psy : seg.psy + seg.pdy * ds;

  return { x, y };
}

export function newVertexFromSplitSeg(
  seg: Seg,
  x: number,
  y: number,
  num_new_vert: number
): Vertex {
  const vert = new Vertex(x, y);
  vert.is_new = true;
  vert.is_used = true;
  vert.index = num_new_vert;

  // Compute wall-tip info
  if (seg.linedef === null) {
    addWallTip(vert, seg.pdx, seg.pdy, true, true);
    addWallTip(vert, -seg.pdx, -seg.pdy, true, true);
  } else {
    const front = seg.side ? seg.linedef.left : seg.linedef.right;
    const back = seg.side ? seg.linedef.right : seg.linedef.left;

    const left = back !== null && back.sector >= 0;
    const right = front !== null && front.sector >= 0;

    addWallTip(vert, seg.pdx, seg.pdy, left, right);
    addWallTip(vert, -seg.pdx, -seg.pdy, right, left);
  }

  return vert;
}

export function splitSeg(seg: Seg, x: number, y: number, num_new_vert: number): Seg {
  const new_vert = newVertexFromSplitSeg(seg, x, y, num_new_vert);
  const new_seg = new Seg(new_vert, seg.end, seg.linedef, seg.side);

  // Copy seg info
  new_seg.partner = seg.partner;
  new_seg.source_line = seg.source_line;
  new_seg.index = seg.index;

  seg.end = new_vert;

  seg.recompute();
  new_seg.recompute();

  // Handle partners
  if (seg.partner) {
    new_seg.partner = new Seg(new_seg.end, new_seg.start, new_seg.linedef, 1 - new_seg.side);

    // Copy seg info
    new_seg.partner.partner = new_seg;
    new_seg.partner.source_line = seg.partner.source_line;
    new_seg.partner.index = seg.partner.index;
    new_seg.partner.next = seg.partner.next;

    seg.partner.start = new_vert;

    seg.partner.recompute();
    new_seg.partner.recompute();

    // Link into list
    seg.partner.next = new_seg.partner;
  }

  return new_seg;
}

export function addIntersection(
  cut_list: Intersection | null,
  vert: Vertex,
  part: Seg,
  self_ref: boolean
): Intersection | null {
  const open_before = checkOpen(vert, -part.pdx, -part.pdy);
  const open_after = checkOpen(vert, part.pdx, part.pdy);

  const along_dist = part.parallelDist(vert.x, vert.y);

  // Merge with any existing vertex
  for (let cut = cut_list; cut; cut = cut.next) {
    if (vert.overlaps(cut.vertex)) {
      return cut_list;
    }
  }

  // Create new intersection
  const cut = new Intersection(vert);
  cut.along_dist = along_dist;
  cut.self_ref = self_ref;
  cut.open_before = open_before;
  cut.open_after = open_after;

  // Insert into list (sorted by along_dist)
  let after: Intersection | null = cut_list;
  while (after && after.next) {
    after = after.next;
  }

  while (after && cut.along_dist < after.along_dist) {
    after = after.prev;
  }

  // Link it in
  cut.next = after ? after.next : cut_list;
  cut.prev = after;

  if (after) {
    if (after.next) {
      after.next.prev = cut;
    }
    after.next = cut;
  } else {
    if (cut_list) {
      cut_list.prev = cut;
    }
    return cut;
  }

  return cut_list;
}

export function divideOneSeg(
  seg: Seg,
  part: Seg,
  left_list_ref: { list: Seg | null },
  right_list_ref: { list: Seg | null },
  cut_list_ref: { list: Intersection | null },
  num_new_vert_ref: { count: number }
): void {
  // Get state of lines' relation to each other
  let a = part.perpDist(seg.psx, seg.psy);
  let b = part.perpDist(seg.pex, seg.pey);

  const self_ref = seg.linedef ? seg.linedef.self_ref : false;

  if (seg.source_line === part.source_line) {
    a = b = 0;
  }

  // Check for being on the same line
  if (Math.abs(a) <= DIST_EPSILON && Math.abs(b) <= DIST_EPSILON) {
    cut_list_ref.list = addIntersection(cut_list_ref.list, seg.start, part, self_ref);
    cut_list_ref.list = addIntersection(cut_list_ref.list, seg.end, part, self_ref);

    // This seg runs along the same line as the partition
    if (seg.pdx * part.pdx + seg.pdy * part.pdy < 0) {
      left_list_ref.list = listAddSeg(left_list_ref.list, seg);
    } else {
      right_list_ref.list = listAddSeg(right_list_ref.list, seg);
    }
    return;
  }

  // Check for right side
  if (a > -DIST_EPSILON && b > -DIST_EPSILON) {
    if (a < DIST_EPSILON) {
      cut_list_ref.list = addIntersection(cut_list_ref.list, seg.start, part, self_ref);
    } else if (b < DIST_EPSILON) {
      cut_list_ref.list = addIntersection(cut_list_ref.list, seg.end, part, self_ref);
    }

    right_list_ref.list = listAddSeg(right_list_ref.list, seg);
    return;
  }

  // Check for left side
  if (a < DIST_EPSILON && b < DIST_EPSILON) {
    if (a > -DIST_EPSILON) {
      cut_list_ref.list = addIntersection(cut_list_ref.list, seg.start, part, self_ref);
    } else if (b > -DIST_EPSILON) {
      cut_list_ref.list = addIntersection(cut_list_ref.list, seg.end, part, self_ref);
    }

    left_list_ref.list = listAddSeg(left_list_ref.list, seg);
    return;
  }

  // Split the seg
  const { x, y } = computeIntersection(seg, part, a, b);

  const new_seg = splitSeg(seg, x, y, num_new_vert_ref.count);
  num_new_vert_ref.count++;

  cut_list_ref.list = addIntersection(cut_list_ref.list, seg.end, part, self_ref);

  if (a < 0) {
    left_list_ref.list = listAddSeg(left_list_ref.list, seg);
    right_list_ref.list = listAddSeg(right_list_ref.list, new_seg);
  } else {
    right_list_ref.list = listAddSeg(right_list_ref.list, seg);
    left_list_ref.list = listAddSeg(left_list_ref.list, new_seg);
  }
}

export function separateSegs(
  tree: QuadTree,
  part: Seg,
  left_list_ref: { list: Seg | null },
  right_list_ref: { list: Seg | null },
  cut_list_ref: { list: Intersection | null },
  num_new_vert_ref: { count: number }
): void {
  while (tree.list !== null) {
    const seg = tree.list;
    tree.list = seg.next;

    seg.quad = null;
    divideOneSeg(seg, part, left_list_ref, right_list_ref, cut_list_ref, num_new_vert_ref);
  }

  // Recursively handle sub-blocks
  if (tree.subs[0] !== null && tree.subs[1] !== null) {
    separateSegs(tree.subs[0], part, left_list_ref, right_list_ref, cut_list_ref, num_new_vert_ref);
    separateSegs(tree.subs[1], part, left_list_ref, right_list_ref, cut_list_ref, num_new_vert_ref);
  }
}

export function addMinisegs(
  cut_list: Intersection | null,
  part: Seg,
  left_list_ref: { list: Seg | null },
  right_list_ref: { list: Seg | null }
): void {
  // Find open gaps in the intersection list, convert to minisegs
  for (let cut = cut_list; cut && cut.next; cut = cut.next) {
    const next = cut.next;

    const A = cut.open_after;
    const B = next.open_before;

    // Nothing possible when both ends are CLOSED
    if (!(A || B)) {
      continue;
    }

    if (A !== B) {
      // Mismatch indicates something wrong with level geometry
      continue;
    }

    // We have definite open space - create a miniseg pair
    const seg = new Seg(cut.vertex, next.vertex, null, 0);
    const buddy = new Seg(next.vertex, cut.vertex, null, 0);

    seg.partner = buddy;
    buddy.partner = seg;

    seg.index = buddy.index = -1;
    seg.source_line = buddy.source_line = part.linedef;

    seg.recompute();
    buddy.recompute();

    // Add to appropriate lists
    right_list_ref.list = listAddSeg(right_list_ref.list, seg);
    left_list_ref.list = listAddSeg(left_list_ref.list, buddy);
  }
}
