/**
 * Node builder public API
 */

import {
  Vertex,
  Linedef,
  Sidedef,
  Sector,
  Subsec,
} from './types';
import {
  detectOverlappingVertices,
  detectOverlappingLines,
  calculateWallTips,
} from './preprocess';
import { createSegs } from './seg';
import { buildNodes, clockwiseBspTree } from './build';
import { Bbox } from './types';

export interface NodeBuilderInput {
  vertices: Array<{ x: number; y: number }>;
  linedefs: Array<{
    v1: number;
    v2: number;
    sidefront: number;
    sideback: number;
    two_sided?: boolean;
    special?: number;
  }>;
  sidedefs: Array<{ sector: number }>;
  sectors: Array<{ index?: number }>;
}

export interface NodeBuilderOutput {
  segs: Array<{
    startVertex: number;
    endVertex: number;
    angle: number;
    linedef: number;
    side: number;
    offset: number;
  }>;
  subsectors: Array<{
    segCount: number;
    firstSeg: number;
  }>;
  newVertices: Array<{ x: number; y: number }>;
}

export function buildSubsectors(
  input: NodeBuilderInput,
  options: { fast?: boolean; debug?: boolean } = {}
): NodeBuilderOutput {
  const fast = options.fast ?? true;
  const debug = options.debug ?? false;

  // Convert input to internal types
  const vertices: Vertex[] = input.vertices.map(
    (v, i) => {
      const vert = new Vertex(v.x, v.y);
      vert.index = i;
      vert.is_used = true;
      return vert;
    }
  );

  const _sectors: Sector[] = input.sectors.map((s, i) => new Sector(s.index ?? i));

  const sidedefs: Sidedef[] = input.sidedefs.map((sd, i) => {
    const sidedef = new Sidedef(sd.sector);
    sidedef.index = i;
    return sidedef;
  });

  const linedefs: Linedef[] = input.linedefs.map((ld, i) => {
    const start = vertices[ld.v1]!;
    const end = vertices[ld.v2]!;
    const right = ld.sidefront >= 0 ? (sidedefs[ld.sidefront] ?? null) : null;
    const left = ld.sideback >= 0 ? (sidedefs[ld.sideback] ?? null) : null;

    const linedef = new Linedef(start, end, right, left);
    linedef.index = i;
    linedef.two_sided = ld.two_sided ?? false;
    linedef.type = ld.special ?? 0;

    // Check for zero length
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    if (dx < 0.01 && dy < 0.01) {
      linedef.zero_len = true;
    }

    // Check for precious (tag >= 900)
    if (linedef.type >= 900) {
      linedef.is_precious = true;
    }

    // Check for self-ref
    if (left && right && left.sector === right.sector) {
      linedef.self_ref = true;
    }

    return linedef;
  });

  // Preprocess
  detectOverlappingVertices(vertices, linedefs);
  detectOverlappingLines(linedefs);
  calculateWallTips(linedefs);

  // Create initial segs
  const seg_list = createSegs(linedefs);

  // Build BSP tree
  const subsectors: Subsec[] = [];
  const num_new_vert_ref = { count: 0 };
  const bounds = new Bbox();

  const _result = buildNodes(seg_list, 0, bounds, subsectors, num_new_vert_ref, fast);

  // Post-process: clockwise ordering
  clockwiseBspTree(subsectors);

  if (debug) {
    console.log(`Built ${subsectors.length} subsectors`);
    for (let i = 0; i < Math.min(5, subsectors.length); i++) {
      const sub = subsectors[i]!;
      console.log(`  Subsector ${i}: ${sub.seg_count} segs`);
      let segNum = 0;
      for (let seg = sub.seg_list; seg && segNum < 10; seg = seg.next, segNum++) {
        console.log(
          `    Seg ${segNum}: (${seg.start.x.toFixed(1)},${seg.start.y.toFixed(1)}) -> (${seg.end.x.toFixed(1)},${seg.end.y.toFixed(1)}) linedef=${seg.linedef?.index ?? 'miniseg'}`
        );
      }
    }
  }

  // Collect new vertices
  const new_vertices: Vertex[] = [];

  // Find all new vertices from segs
  const seen_new_verts = new Set<number>();
  for (const sub of subsectors) {
    for (let seg = sub.seg_list; seg; seg = seg.next) {
      if (seg.start.is_new && !seen_new_verts.has(seg.start.index)) {
        seen_new_verts.add(seg.start.index);
        new_vertices.push(seg.start);
      }
      if (seg.end.is_new && !seen_new_verts.has(seg.end.index)) {
        seen_new_verts.add(seg.end.index);
        new_vertices.push(seg.end);
      }
    }
  }

  // Sort new vertices by index
  new_vertices.sort((a, b) => a.index - b.index);

  // Build output segs array
  const output_segs: Array<{
    startVertex: number;
    endVertex: number;
    angle: number;
    linedef: number;
    side: number;
    offset: number;
  }> = [];

  for (const sub of subsectors) {
    for (let seg = sub.seg_list; seg; seg = seg.next) {
      const start_idx = seg.start.is_new
        ? vertices.length + seg.start.index
        : seg.start.index;
      const end_idx = seg.end.is_new ? vertices.length + seg.end.index : seg.end.index;

      output_segs.push({
        startVertex: start_idx,
        endVertex: end_idx,
        angle: 0,
        linedef: seg.linedef ? seg.linedef.index : -1,
        side: seg.side,
        offset: 0,
      });
    }
  }

  // Build output subsectors array
  const output_subsectors: Array<{ segCount: number; firstSeg: number }> = [];
  let firstSeg = 0;

  for (const sub of subsectors) {
    output_subsectors.push({
      segCount: sub.seg_count,
      firstSeg: firstSeg,
    });
    firstSeg += sub.seg_count;
  }

  return {
    segs: output_segs,
    subsectors: output_subsectors,
    newVertices: new_vertices.map((v) => ({ x: v.x, y: v.y })),
  };
}
