/**
 * BSP tree building and subsector processing
 */

import { Seg, Subsec, Node, Bbox, QuadTree, Intersection } from './types';
import { findLimits2, separateSegs, addMinisegs } from './seg';
import { treeFromSegList } from './quadtree';
import { pickNode } from './picknode';
import { computeAngle } from './math';

export interface BuildResult {
  ok: boolean;
  subsectors: Subsec[];
}

function createSubsec(tree: QuadTree, subsectors: Subsec[]): Subsec {
  const sub = new Subsec();
  sub.index = subsectors.length;

  // Copy segs into subsector
  sub.seg_list = tree.convertToList();

  sub.determineMiddle();

  subsectors.push(sub);

  return sub;
}

export function buildNodes(
  list: Seg | null,
  depth: number,
  bounds: Bbox,
  subsectors: Subsec[],
  num_new_vert_ref: { count: number },
  fast: boolean
): { node: Node | null; subsec: Subsec | null } {
  // Determine bounds of segs
  findLimits2(list, bounds);

  const tree = treeFromSegList(list, bounds);

  // Pick partition line, null indicates convexity
  const part = pickNode(tree, depth, fast);

  if (part === null) {
    // Convex - create subsector
    const subsec = createSubsec(tree, subsectors);
    return { node: null, subsec };
  }

  const node = new Node();

  // Divide segs into two lists: left & right
  const left_tree = new QuadTree(bounds.minx, bounds.miny, bounds.maxx, bounds.maxy);
  const right_tree = new QuadTree(bounds.minx, bounds.miny, bounds.maxx, bounds.maxy);
  const cut_list_ref = { list: null as Intersection | null };

  separateSegs(tree, part, left_tree, right_tree, cut_list_ref, num_new_vert_ref);

  if (cut_list_ref.list !== null) {
    addMinisegs(cut_list_ref.list, part, left_tree, right_tree);
  }

  // Set partition
  if (part.linedef) {
    if (part.side === 0) {
      node.x = part.linedef.start.x;
      node.y = part.linedef.start.y;
      node.dx = part.linedef.end.x - node.x;
      node.dy = part.linedef.end.y - node.y;
    } else {
      node.x = part.linedef.end.x;
      node.y = part.linedef.end.y;
      node.dx = part.linedef.start.x - node.x;
      node.dy = part.linedef.start.y - node.y;
    }

    // Check for very long partition
    if (Math.abs(node.dx) > 32766 || Math.abs(node.dy) > 32766) {
      node.dx = node.dx / 2.0;
      node.dy = node.dy / 2.0;
    }
  }

  // Recursively build left side
  const left_list = left_tree.convertToList();
  const left_result = buildNodes(
    left_list,
    depth + 1,
    node.l_bounds,
    subsectors,
    num_new_vert_ref,
    fast
  );
  node.l_node = left_result.node;
  node.l_subsec = left_result.subsec;

  // Recursively build right side
  const right_list = right_tree.convertToList();
  const right_result = buildNodes(
    right_list,
    depth + 1,
    node.r_bounds,
    subsectors,
    num_new_vert_ref,
    fast
  );
  node.r_node = right_result.node;
  node.r_subsec = right_result.subsec;

  return { node, subsec: null };
}

export function clockwiseOrderSubsec(sub: Subsec): void {
  const array: Seg[] = [];

  for (let seg = sub.seg_list; seg; seg = seg.next) {
    // Compute angle now
    seg.cmp_angle = computeAngle(seg.start.x - sub.mid_x, seg.start.y - sub.mid_y);
    array.push(seg);
  }

  // Sort segs by angle (descending = clockwise)
  let i = 0;
  while (i + 1 < array.length) {
    const A = array[i]!;
    const B = array[i + 1]!;

    if (A.cmp_angle < B.cmp_angle) {
      // Swap
      array[i] = B;
      array[i + 1] = A;

      // Bubble down
      if (i > 0) {
        i--;
      }
    } else {
      // Bubble up
      i++;
    }
  }

  // Choose first seg (prefer non-miniseg, non-self-ref)
  let first = 0;
  let score = -1;

  for (i = 0; i < array.length; i++) {
    const seg = array[i]!;
    let cur_score = 3;

    if (!seg.linedef) {
      cur_score = 0;
    } else if (seg.linedef.self_ref) {
      cur_score = 2;
    }

    if (cur_score > score) {
      first = i;
      score = cur_score;
    }
  }

  // Transfer sorted array back into subsector
  sub.seg_list = null;

  for (i = 0; i < array.length; i++) {
    const k = (first + i) % array.length;
    sub.addToTail(array[k]!);
  }
}

export function renumberSegs(sub: Subsec, cur_seg_index_ref: { index: number }): void {
  sub.seg_count = 0;

  for (let seg = sub.seg_list; seg; seg = seg.next) {
    seg.index = cur_seg_index_ref.index;
    cur_seg_index_ref.index += 1;
    sub.seg_count++;
  }
}

export function clockwiseBspTree(subsectors: Subsec[]): void {
  const cur_seg_index_ref = { index: 0 };

  for (const sub of subsectors) {
    clockwiseOrderSubsec(sub);
    renumberSegs(sub, cur_seg_index_ref);
  }
}
