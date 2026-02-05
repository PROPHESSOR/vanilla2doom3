/**
 * QuadTree operations
 */

import { QuadTree, Seg, Bbox } from './types';
import { listAddSeg } from './seg';

export function addSegToTree(tree: QuadTree, seg: Seg): void {
  // Update seg counts
  if (seg.linedef !== null) {
    tree.real_num++;
  } else {
    tree.mini_num++;
  }

  if (tree.subs[0] !== null) {
    const x_min = Math.min(seg.start.x, seg.end.x);
    const y_min = Math.min(seg.start.y, seg.end.y);
    const x_max = Math.max(seg.start.x, seg.end.x);
    const y_max = Math.max(seg.start.y, seg.end.y);

    if (tree.x2 - tree.x1 >= tree.y2 - tree.y1) {
      if (x_min > tree.subs[1]!.x1) {
        addSegToTree(tree.subs[1]!, seg);
        return;
      } else if (x_max < tree.subs[0]!.x2) {
        addSegToTree(tree.subs[0]!, seg);
        return;
      }
    } else {
      if (y_min > tree.subs[1]!.y1) {
        addSegToTree(tree.subs[1]!, seg);
        return;
      } else if (y_max < tree.subs[0]!.y2) {
        addSegToTree(tree.subs[0]!, seg);
        return;
      }
    }
  }

  // Link into this node
  tree.list = listAddSeg(tree.list, seg);
  seg.quad = tree;
}

export function addListToTree(tree: QuadTree, new_list: Seg | null): void {
  while (new_list !== null) {
    const seg = new_list;
    new_list = seg.next;
    addSegToTree(tree, seg);
  }
}

export function convertToList(tree: QuadTree): Seg | null {
  let result: Seg | null = null;

  while (tree.list !== null) {
    const seg = tree.list;
    tree.list = seg.next;
    result = listAddSeg(result, seg);
  }

  if (tree.subs[0] !== null && tree.subs[1] !== null) {
    const left = convertToList(tree.subs[0]);
    const right = convertToList(tree.subs[1]);

    // Concatenate lists properly handling null cases
    // Find tail of result and append left
    if (result === null) {
      result = left;
    } else {
      let tail: Seg | null = result;
      while (tail.next !== null) {
        tail = tail.next;
      }
      tail.next = left;
    }

    // Find tail of result (now including left) and append right
    if (result === null) {
      result = right;
    } else {
      let tail: Seg | null = result;
      while (tail.next !== null) {
        tail = tail.next;
      }
      tail.next = right;
    }
  }

  return result;
}

export function onLineSide(tree: QuadTree, part: Seg): number {
  // Expand bounds a bit
  const tx1 = tree.x1 - 0.4;
  const ty1 = tree.y1 - 0.4;
  const tx2 = tree.x2 + 0.4;
  const ty2 = tree.y2 + 0.4;

  let p1: number, p2: number;

  // Handle simple cases (vertical & horizontal lines)
  if (part.pdx === 0) {
    p1 = tx1 > part.psx ? +1 : -1;
    p2 = tx2 > part.psx ? +1 : -1;

    if (part.pdy < 0) {
      p1 = -p1;
      p2 = -p2;
    }
  } else if (part.pdy === 0) {
    p1 = ty1 < part.psy ? +1 : -1;
    p2 = ty2 < part.psy ? +1 : -1;

    if (part.pdx < 0) {
      p1 = -p1;
      p2 = -p2;
    }
  } else if (part.pdx * part.pdy > 0) {
    // Positive slope
    p1 = part.pointOnLineSide(tx1, ty2);
    p2 = part.pointOnLineSide(tx2, ty1);
  } else {
    // Negative slope
    p1 = part.pointOnLineSide(tx1, ty1);
    p2 = part.pointOnLineSide(tx2, ty2);
  }

  // Line goes through or touches the box?
  if (p1 !== p2) {
    return 0;
  }

  return p1;
}

export function treeFromSegList(list: Seg | null, bounds: Bbox): QuadTree {
  const tree = new QuadTree(bounds.minx, bounds.miny, bounds.maxx, bounds.maxy);
  addListToTree(tree, list);
  return tree;
}

// Add methods to QuadTree prototype
declare module './types' {
  interface QuadTree {
    addSeg(seg: Seg): void;
    addList(list: Seg | null): void;
    convertToList(): Seg | null;
    onLineSide(part: Seg): number;
  }
}

QuadTree.prototype.addSeg = function (seg: Seg): void {
  addSegToTree(this, seg);
};

QuadTree.prototype.addList = function (list: Seg | null): void {
  addListToTree(this, list);
};

QuadTree.prototype.convertToList = function (): Seg | null {
  return convertToList(this);
};

QuadTree.prototype.onLineSide = function (part: Seg): number {
  return onLineSide(this, part);
};
