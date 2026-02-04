/**
 * Partition line selection (PickNode)
 */

import { Seg, QuadTree } from './types';
import {
  DIST_EPSILON,
  IFFY_LEN,
  PRECIOUS_MULTIPLY,
  SEG_FAST_THRESHOLD,
  SPLIT_COST_DEFAULT,
} from './constants';

interface EvalInfo {
  cost: number;
  splits: number;
  iffy: number;
  near_miss: number;
  real_left: number;
  real_right: number;
  mini_left: number;
  mini_right: number;
}

function bumpLeft(info: EvalInfo, linedef: any): void {
  if (linedef !== null) {
    info.real_left++;
  } else {
    info.mini_left++;
  }
}

function bumpRight(info: EvalInfo, linedef: any): void {
  if (linedef !== null) {
    info.real_right++;
  } else {
    info.mini_right++;
  }
}

function evalPartitionWorker(
  tree: QuadTree,
  part: Seg,
  best_cost: number,
  info: EvalInfo
): boolean {
  const split_cost = SPLIT_COST_DEFAULT;

  // Test the whole quad against the partition line
  const side = tree.onLineSide(part);

  if (side < 0) {
    // LEFT
    info.real_left += tree.real_num;
    info.mini_left += tree.mini_num;
    return false;
  } else if (side > 0) {
    // RIGHT
    info.real_right += tree.real_num;
    info.mini_right += tree.mini_num;
    return false;
  }

  // Check partition against all segs
  for (let check = tree.list; check; check = check.next) {
    // Prune early if cost too high
    if (info.cost > best_cost) {
      return true;
    }

    let a = 0,
      fa = 0;
    let b = 0,
      fb = 0;
    let qnty: number;

    // Get state of lines' relation to each other
    if (check.source_line !== part.source_line) {
      a = part.perpDist(check.psx, check.psy);
      b = part.perpDist(check.pex, check.pey);

      fa = Math.abs(a);
      fb = Math.abs(b);
    }

    // Check for being on the same line
    if (fa <= DIST_EPSILON && fb <= DIST_EPSILON) {
      if (check.pdx * part.pdx + check.pdy * part.pdy < 0) {
        bumpLeft(info, check.linedef);
      } else {
        bumpRight(info, check.linedef);
      }
      continue;
    }

    // Check for passing through a vertex
    if (fa <= DIST_EPSILON || fb <= DIST_EPSILON) {
      if (check.linedef !== null && check.linedef.is_precious) {
        info.cost += 40.0 * split_cost * PRECIOUS_MULTIPLY;
      }
    }

    // Check for right side
    if (a > -DIST_EPSILON && b > -DIST_EPSILON) {
      bumpRight(info, check.linedef);

      // Check for near miss
      if (
        (a >= IFFY_LEN && b >= IFFY_LEN) ||
        (a <= DIST_EPSILON && b >= IFFY_LEN) ||
        (b <= DIST_EPSILON && a >= IFFY_LEN)
      ) {
        continue;
      }

      info.near_miss++;

      if (a <= DIST_EPSILON || b <= DIST_EPSILON) {
        qnty = IFFY_LEN / Math.max(a, b);
      } else {
        qnty = IFFY_LEN / Math.min(a, b);
      }

      info.cost += 70.0 * split_cost * (qnty * qnty - 1.0);
      continue;
    }

    // Check for left side
    if (a < DIST_EPSILON && b < DIST_EPSILON) {
      bumpLeft(info, check.linedef);

      // Check for near miss
      if (
        (a <= -IFFY_LEN && b <= -IFFY_LEN) ||
        (a >= -DIST_EPSILON && b <= -IFFY_LEN) ||
        (b >= -DIST_EPSILON && a <= -IFFY_LEN)
      ) {
        continue;
      }

      info.near_miss++;

      if (a >= -DIST_EPSILON || b >= -DIST_EPSILON) {
        qnty = IFFY_LEN / -Math.min(a, b);
      } else {
        qnty = IFFY_LEN / -Math.max(a, b);
      }

      info.cost += 70.0 * split_cost * (qnty * qnty - 1.0);
      continue;
    }

    // Seg will be split
    info.splits++;

    if (check.linedef && check.linedef.is_precious) {
      info.cost += 100.0 * split_cost * PRECIOUS_MULTIPLY;
    } else {
      info.cost += 100.0 * split_cost;
    }

    // Check if split point is very close to one end
    if (fa < IFFY_LEN || fb < IFFY_LEN) {
      info.iffy++;

      qnty = IFFY_LEN / Math.min(fa, fb);
      info.cost += 140.0 * split_cost * (qnty * qnty - 1.0);
    }
  }

  // Handle sub-blocks recursively
  for (let c = 0; c < 2; c++) {
    if (info.cost > best_cost) {
      return true;
    }

    if (tree.subs[c] !== null && !tree.subs[c]!.empty()) {
      if (evalPartitionWorker(tree.subs[c]!, part, best_cost, info)) {
        return true;
      }
    }
  }

  return false;
}

function evalPartition(tree: QuadTree, part: Seg, best_cost: number): number {
  const info: EvalInfo = {
    cost: 0,
    splits: 0,
    iffy: 0,
    near_miss: 0,
    real_left: 0,
    real_right: 0,
    mini_left: 0,
    mini_right: 0,
  };

  if (evalPartitionWorker(tree, part, best_cost, info)) {
    return -1.0;
  }

  // Make sure there is at least one real seg on each side
  if (info.real_left === 0 || info.real_right === 0) {
    return -1;
  }

  // Increase cost by difference between left & right
  info.cost += 100.0 * Math.abs(info.real_left - info.real_right);

  // Allow miniseg counts to affect outcome
  info.cost += 50.0 * Math.abs(info.mini_left - info.mini_right);

  // Prefer horizontal or vertical partition lines
  if (part.pdx !== 0 && part.pdy !== 0) {
    info.cost += 25.0;
  }

  return info.cost;
}

function evaluateFastWorker(
  tree: QuadTree,
  best_H_ref: { seg: Seg | null },
  best_V_ref: { seg: Seg | null },
  mid_x: number,
  mid_y: number
): void {
  for (let part = tree.list; part; part = part.next) {
    // Ignore minisegs
    if (part.linedef === null) {
      continue;
    }

    if (part.pdy === 0) {
      // Horizontal seg
      if (!best_H_ref.seg) {
        best_H_ref.seg = part;
      } else {
        const old_dist = Math.abs(best_H_ref.seg.psy - mid_y);
        const new_dist = Math.abs(part.psy - mid_y);

        if (new_dist < old_dist) {
          best_H_ref.seg = part;
        }
      }
    } else if (part.pdx === 0) {
      // Vertical seg
      if (!best_V_ref.seg) {
        best_V_ref.seg = part;
      } else {
        const old_dist = Math.abs(best_V_ref.seg.psx - mid_x);
        const new_dist = Math.abs(part.psx - mid_x);

        if (new_dist < old_dist) {
          best_V_ref.seg = part;
        }
      }
    }
  }

  // Handle sub-blocks recursively
  for (let c = 0; c < 2; c++) {
    if (tree.subs[c] !== null && !tree.subs[c]!.empty()) {
      evaluateFastWorker(tree.subs[c]!, best_H_ref, best_V_ref, mid_x, mid_y);
    }
  }
}

function findFastSeg(tree: QuadTree): Seg | null {
  const best_H_ref = { seg: null as Seg | null };
  const best_V_ref = { seg: null as Seg | null };

  const mid_x = (tree.x1 + tree.x2) / 2;
  const mid_y = (tree.y1 + tree.y2) / 2;

  evaluateFastWorker(tree, best_H_ref, best_V_ref, mid_x, mid_y);

  let H_cost = -1.0;
  let V_cost = -1.0;

  if (best_H_ref.seg) {
    H_cost = evalPartition(tree, best_H_ref.seg, 1.0e99);
  }

  if (best_V_ref.seg) {
    V_cost = evalPartition(tree, best_V_ref.seg, 1.0e99);
  }

  if (H_cost < 0 && V_cost < 0) {
    return null;
  }

  if (H_cost < 0) return best_V_ref.seg;
  if (V_cost < 0) return best_H_ref.seg;

  return V_cost < H_cost ? best_V_ref.seg : best_H_ref.seg;
}

function pickNodeWorker(
  part_list: QuadTree,
  tree: QuadTree,
  best_ref: { seg: Seg | null },
  best_cost_ref: { cost: number }
): boolean {
  // Try each seg as partition
  for (let part = part_list.list; part; part = part.next) {
    // Ignore minisegs
    if (part.linedef === null) {
      continue;
    }

    const cost = evalPartition(tree, part, best_cost_ref.cost);

    // Seg unsuitable or too costly
    if (cost < 0 || cost >= best_cost_ref.cost) {
      continue;
    }

    // New better choice
    best_cost_ref.cost = cost;
    best_ref.seg = part;
  }

  // Recursively handle sub-blocks
  for (let c = 0; c < 2; c++) {
    if (part_list.subs[c] !== null && !part_list.subs[c]!.empty()) {
      if (!pickNodeWorker(part_list.subs[c]!, tree, best_ref, best_cost_ref)) {
        return false;
      }
    }
  }

  return true;
}

export function pickNode(tree: QuadTree, depth: number, fast: boolean): Seg | null {
  const best_ref = { seg: null as Seg | null };
  const best_cost_ref = { cost: 1.0e99 };

  // Fast mode for large levels
  if (fast && tree.real_num >= SEG_FAST_THRESHOLD) {
    const best = findFastSeg(tree);
    if (best !== null) {
      return best;
    }
  }

  if (!pickNodeWorker(tree, tree, best_ref, best_cost_ref)) {
    return null;
  }

  return best_ref.seg;
}
