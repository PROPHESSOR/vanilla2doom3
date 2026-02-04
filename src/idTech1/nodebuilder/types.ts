/**
 * Internal types for node builder
 */

import { DIST_EPSILON } from './constants';

export class WallTip {
  angle: number = 0;
  open_left: boolean = false;
  open_right: boolean = false;
  next: WallTip | null = null;
  prev: WallTip | null = null;
}

export class Vertex {
  x: number;
  y: number;
  index: number = -1;
  is_new: boolean = false;
  is_used: boolean = false;
  overlap: Vertex | null = null;
  tip_set: WallTip | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  overlaps(other: Vertex): boolean {
    const dx = Math.abs(other.x - this.x);
    const dy = Math.abs(other.y - this.y);
    return dx < DIST_EPSILON && dy < DIST_EPSILON;
  }
}

export class Sidedef {
  sector: number;
  index: number = -1;

  constructor(sector: number) {
    this.sector = sector;
  }
}

export class Sector {
  index: number = -1;

  constructor(index: number) {
    this.index = index;
  }
}

export class Linedef {
  start: Vertex;
  end: Vertex;
  right: Sidedef | null;
  left: Sidedef | null;
  two_sided: boolean = false;
  zero_len: boolean = false;
  overlap: Linedef | null = null;
  is_precious: boolean = false;
  self_ref: boolean = false;
  index: number = -1;
  type: number = 0;

  constructor(
    start: Vertex,
    end: Vertex,
    right: Sidedef | null,
    left: Sidedef | null
  ) {
    this.start = start;
    this.end = end;
    this.right = right;
    this.left = left;
  }

  minX(): number {
    return Math.min(this.start.x, this.end.x);
  }
}

export class Seg {
  start: Vertex;
  end: Vertex;
  linedef: Linedef | null;
  side: number = 0;
  partner: Seg | null = null;
  source_line: Linedef | null = null;
  index: number = -1;
  is_degenerate: boolean = false;
  next: Seg | null = null;
  quad: QuadTree | null = null;

  // Precomputed data
  psx: number = 0;
  psy: number = 0;
  pex: number = 0;
  pey: number = 0;
  pdx: number = 0;
  pdy: number = 0;
  p_length: number = 0;
  p_para: number = 0;
  p_perp: number = 0;
  cmp_angle: number = 0;

  constructor(start: Vertex, end: Vertex, linedef: Linedef | null, side: number) {
    this.start = start;
    this.end = end;
    this.linedef = linedef;
    this.side = side;
  }

  recompute(): void {
    this.psx = this.start.x;
    this.psy = this.start.y;
    this.pex = this.end.x;
    this.pey = this.end.y;
    this.pdx = this.pex - this.psx;
    this.pdy = this.pey - this.psy;

    this.p_length = Math.hypot(this.pdx, this.pdy);

    if (this.p_length <= 0) {
      throw new Error('Seg has zero p_length');
    }

    this.p_perp = this.psy * this.pdx - this.psx * this.pdy;
    this.p_para = -this.psx * this.pdx - this.psy * this.pdy;
  }

  pointOnLineSide(x: number, y: number): number {
    const perp = this.perpDist(x, y);

    if (Math.abs(perp) <= DIST_EPSILON) {
      return 0;
    }

    return perp < 0 ? -1 : 1;
  }

  parallelDist(x: number, y: number): number {
    return (x * this.pdx + y * this.pdy + this.p_para) / this.p_length;
  }

  perpDist(x: number, y: number): number {
    return (x * this.pdy - y * this.pdx + this.p_perp) / this.p_length;
  }
}

export class Subsec {
  seg_list: Seg | null = null;
  seg_count: number = 0;
  index: number = -1;
  mid_x: number = 0;
  mid_y: number = 0;

  addToTail(seg: Seg): void {
    seg.next = null;

    if (this.seg_list === null) {
      this.seg_list = seg;
      return;
    }

    let tail = this.seg_list;
    while (tail.next !== null) {
      tail = tail.next;
    }

    tail.next = seg;
  }

  determineMiddle(): void {
    this.mid_x = 0;
    this.mid_y = 0;

    let total = 0;

    for (let seg = this.seg_list; seg; seg = seg.next) {
      this.mid_x += seg.start.x + seg.end.x;
      this.mid_y += seg.start.y + seg.end.y;
      total += 2;
    }

    if (total > 0) {
      this.mid_x /= total;
      this.mid_y /= total;
    }
  }
}

export class Bbox {
  minx: number = 0;
  miny: number = 0;
  maxx: number = 0;
  maxy: number = 0;
}

export class QuadTree {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  subs: [QuadTree | null, QuadTree | null] = [null, null];
  real_num: number = 0;
  mini_num: number = 0;
  list: Seg | null = null;

  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx <= 320 && dy <= 320) {
      // Leaf node
      this.subs = [null, null];
    } else if (dx >= dy) {
      this.subs = [
        new QuadTree(x1, y1, x1 + Math.floor(dx / 2), y2),
        new QuadTree(x1 + Math.floor(dx / 2), y1, x2, y2),
      ];
    } else {
      this.subs = [
        new QuadTree(x1, y1, x2, y1 + Math.floor(dy / 2)),
        new QuadTree(x1, y1 + Math.floor(dy / 2), x2, y2),
      ];
    }
  }

  empty(): boolean {
    return this.real_num + this.mini_num === 0;
  }
}

export class Intersection {
  vertex: Vertex;
  along_dist: number = 0;
  self_ref: boolean = false;
  open_before: boolean = false;
  open_after: boolean = false;
  next: Intersection | null = null;
  prev: Intersection | null = null;

  constructor(vertex: Vertex) {
    this.vertex = vertex;
  }
}

export class Node {
  x: number = 0;
  y: number = 0;
  dx: number = 0;
  dy: number = 0;

  r_node: Node | null = null;
  r_subsec: Subsec | null = null;
  r_bounds: Bbox = new Bbox();

  l_node: Node | null = null;
  l_subsec: Subsec | null = null;
  l_bounds: Bbox = new Bbox();

  index: number = -1;
}
