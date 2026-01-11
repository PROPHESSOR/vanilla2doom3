from wadparser import parseLines, parseSectors, parsePlayerStart, parseSegs, parseSubsectors
from genblock import generateRect3d, generateMapFromBrushes, generateSafeLine, generateLine, generateBox, generateTriPrism, generateCutRectSector
import math
import xml.etree.ElementTree as ET

OFFSET = 2000


def polygon_area(poly):
    area = 0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        area += x1 * y2 - x2 * y1
    return area / 2


def expand_polygon(poly, amount):
    """Expand polygon by pushing vertices outward from centroid"""
    if len(poly) < 3:
        return poly

    # Calculate centroid
    cx = sum(x for x, y in poly) / len(poly)
    cy = sum(y for x, y in poly) / len(poly)

    # Push each vertex outward from centroid
    expanded = []
    for x, y in poly:
        dx = x - cx
        dy = y - cy
        dist = math.sqrt(dx*dx + dy*dy)
        if dist > 0.001:  # Avoid division by zero
            nx = dx / dist
            ny = dy / dist
            expanded.append((x + nx * amount, y + ny * amount))
        else:
            expanded.append((x, y))

    return expanded


def order_polygon(edges):
    if not edges:
        return []

    remaining = edges[:]
    poly = [remaining[0][0], remaining[0][1]]
    remaining.pop(0)

    guard = 0
    while remaining and guard < 10000:
        guard += 1
        last = poly[-1]
        found = False
        for i, edge in enumerate(remaining):
            a, b = edge
            if a == last:
                poly.append(b)
                remaining.pop(i)
                found = True
                break
            if b == last:
                poly.append(a)
                remaining.pop(i)
                found = True
                break

        if not found:
            break

    if len(poly) > 2 and poly[0] == poly[-1]:
        poly.pop()

    return poly


def point_in_triangle(p, a, b, c):
    # Barycentric method
    px, py = p
    ax, ay = a
    bx, by = b
    cx, cy = c

    v0x, v0y = cx - ax, cy - ay
    v1x, v1y = bx - ax, by - ay
    v2x, v2y = px - ax, py - ay

    dot00 = v0x * v0x + v0y * v0y
    dot01 = v0x * v1x + v0y * v1y
    dot02 = v0x * v2x + v0y * v2y
    dot11 = v1x * v1x + v1y * v1y
    dot12 = v1x * v2x + v1y * v2y

    denom = dot00 * dot11 - dot01 * dot01
    if denom == 0:
        return False

    inv_denom = 1 / denom
    u = (dot11 * dot02 - dot01 * dot12) * inv_denom
    v = (dot00 * dot12 - dot01 * dot02) * inv_denom

    return u >= 0 and v >= 0 and (u + v) <= 1


def triangulate(poly):
    if len(poly) < 3:
        return []

    verts = poly[:]
    indices = list(range(len(verts)))
    triangles = []
    orientation = 1 if polygon_area(poly) >= 0 else -1

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    guard = 0
    while len(indices) > 3 and guard < 10000:
        guard += 1
        ear_found = False
        for i in range(len(indices)):
            i_prev = indices[(i - 1) % len(indices)]
            i_curr = indices[i]
            i_next = indices[(i + 1) % len(indices)]

            a, b, c = verts[i_prev], verts[i_curr], verts[i_next]
            if cross(a, b, c) * orientation <= 0:
                continue

            has_inside = False
            for j in indices:
                if j in (i_prev, i_curr, i_next):
                    continue
                if point_in_triangle(verts[j], a, b, c):
                    has_inside = True
                    break

            if has_inside:
                continue

            triangles.append((a, b, c))
            indices.pop(i)
            ear_found = True
            break

        if not ear_found:
            break

    if len(indices) == 3:
        a, b, c = (verts[idx] for idx in indices)
        triangles.append((a, b, c))

    return triangles


def tri_area(a, b, c):
    return abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2


def _dedupe_points(points):
    seen = set()
    out = []
    for p in points:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def convex_hull(points):
    """Monotone chain convex hull. Returns points ordered around the hull.
    Subsectors are convex, so the hull matches the boundary.
    """
    pts = _dedupe_points(points)
    if len(pts) < 3:
        return pts

    pts = sorted(pts)

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    hull = lower[:-1] + upper[:-1]
    return hull


def buildTestSingleSector():
    """Build a simple sealed test room to verify brush normals are correct."""
    from genblock import generateRect3d, generateMapFromBrushes

    # Simple 512x512x128 room
    x, y, z = 1000, 1000, 0
    size = 512
    height = 128
    wall_thickness = 8

    brushes = []

    # Floor and ceiling should extend under walls to seal properly
    # They go from (x - wall_thickness) to (x + size + wall_thickness)
    total_size = size + 2 * wall_thickness

    # Floor
    brushes.append(generateRect3d((x - wall_thickness, y - wall_thickness, z - wall_thickness),
                                  (total_size, total_size, wall_thickness)))

    # Ceiling
    brushes.append(generateRect3d((x - wall_thickness, y - wall_thickness, z + height),
                                  (total_size, total_size, wall_thickness)))

    # Four walls (interior space from x to x+size, y to y+size)
    brushes.append(generateRect3d((x - wall_thickness, y, z), (wall_thickness, size, height)))  # left
    brushes.append(generateRect3d((x + size, y, z), (wall_thickness, size, height)))  # right
    brushes.append(generateRect3d((x, y - wall_thickness, z), (size, wall_thickness, height)))  # front
    brushes.append(generateRect3d((x, y + size, z), (size, wall_thickness, height)))  # back

    with open('doom2doom3.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, (x + size/2, y + size/2, z + 32)))


def export_subsectors_to_svg(subsectors, segs, vertices, sectors, sidedefs_indexed, linedefs, filename='subsectors.svg'):
    """Export subsectors to SVG for visualization."""
    import sys

    # Find bounds
    all_x = [v[0] for v in vertices]
    all_y = [v[1] for v in vertices]
    minx, maxx = min(all_x), max(all_x)
    miny, maxy = min(all_y), max(all_y)

    width = maxx - minx
    height = maxy - miny
    margin = 50

    # SVG canvas size
    svg_width = width + 2 * margin
    svg_height = height + 2 * margin

    # Create SVG root
    svg = ET.Element('svg', {
        'xmlns': 'http://www.w3.org/2000/svg',
        'width': str(int(svg_width)),
        'height': str(int(svg_height)),
        'viewBox': f'{minx - margin} {miny - margin} {int(svg_width)} {int(svg_height)}'
    })

    # Add background
    ET.SubElement(svg, 'rect', {
        'x': str(minx - margin),
        'y': str(miny - margin),
        'width': str(int(svg_width)),
        'height': str(int(svg_height)),
        'fill': 'white'
    })

    # Color palette for different sectors
    colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#C06C84',
        '#6C5B7B', '#355C7D', '#F67280', '#C8E6C9', '#FFCCBC'
    ]

    # Process each subsector
    degenerate_ss = []
    for ss_idx, subsector in enumerate(subsectors):
        seg_count = subsector['segCount']
        first_seg = subsector['firstSeg']

        # Collect both start and end vertices then take convex hull
        pts = []
        sector_idx = None
        sector_counts = {}

        for i in range(seg_count):
            if first_seg + i >= len(segs):
                break

            seg = segs[first_seg + i]
            v_start = seg['startVertex']
            v_end = seg['endVertex']

            if v_start < len(vertices):
                pts.append(vertices[v_start])
            if v_end < len(vertices):
                pts.append(vertices[v_end])

            # Determine sector
            linedef_idx = seg['linedef']
            if linedef_idx < len(linedefs):
                linedef = linedefs[linedef_idx]
                # Majority vote among candidate sectors from both sides
                for side_idx in (linedef['side1'], linedef['side2']):
                    if side_idx != 65535 and side_idx < len(sidedefs_indexed):
                        sidx = sidedefs_indexed[side_idx]['sector']
                        sector_counts[sidx] = sector_counts.get(sidx, 0) + 1
        # Decide sector by majority
        if sector_counts:
            sector_idx = max(sector_counts.items(), key=lambda kv: kv[1])[0]

        poly_vertices = convex_hull(pts)
        if len(poly_vertices) < 3:
            # Draw thin strips along segs so SVG matches map fallback
            degenerate_ss.append(ss_idx)
            strip_width = 8.0
            def seg_strip(p1, p2, width):
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                L = math.hypot(dx, dy)
                if L < 1e-6:
                    return None
                nx = dy / L
                ny = -dx / L
                hw = width * 0.5
                a = (p1[0] + nx * hw, p1[1] + ny * hw)
                b = (p1[0] - nx * hw, p1[1] - ny * hw)
                c = (p2[0] - nx * hw, p2[1] - ny * hw)
                d = (p2[0] + nx * hw, p2[1] + ny * hw)
                return [a, b, c, d]

            for i in range(seg_count):
                if first_seg + i >= len(segs):
                    break
                s = segs[first_seg + i]
                v0 = s['startVertex']
                v1 = s['endVertex']
                if v0 < len(vertices) and v1 < len(vertices):
                    rect = seg_strip(vertices[v0], vertices[v1], strip_width)
                    if rect:
                        ET.SubElement(svg, 'polygon', {
                            'points': ' '.join([f"{x},{y}" for (x,y) in rect]),
                            'fill': '#FFD54F',
                            'fill-opacity': '0.6',
                            'stroke': 'black',
                            'stroke-width': '0.6'
                        })
            continue

        # Handle missing or invalid sector - still draw with a fallback color
        if sector_idx is None or sector_idx >= len(sectors):
            degenerate_ss.append(ss_idx)
            # Draw with gray fallback color for unknown sector
            color = '#CCCCCC'
        else:
            # Get sector info
            sector = sectors[sector_idx]
            floor = sector['heightFloor']
            ceil = sector['heightCeil']
            # Choose color based on sector
            color = colors[sector_idx % len(colors)]

        # Create polygon
        points = ' '.join([f'{x},{y}' for x, y in poly_vertices])

        # Draw filled polygon
        ET.SubElement(svg, 'polygon', {
            'points': points,
            'fill': color,
            'fill-opacity': '0.6',
            'stroke': 'black',
            'stroke-width': '1'
        })

        # Add label at centroid
        cx = sum(x for x, y in poly_vertices) / len(poly_vertices)
        cy = sum(y for x, y in poly_vertices) / len(poly_vertices)

        ET.SubElement(svg, 'text', {
            'x': str(cx),
            'y': str(cy),
            'font-size': '8',
            'text-anchor': 'middle',
            'fill': 'black'
        }).text = f'SS{ss_idx}\nS{sector_idx}'

    # Draw all vertices as small circles
    for i, (x, y) in enumerate(vertices):
        ET.SubElement(svg, 'circle', {
            'cx': str(x),
            'cy': str(y),
            'r': '2',
            'fill': 'red'
        })

    # Overlay: draw all seg edges for context
    for ss_idx, subsector in enumerate(subsectors):
        seg_count = subsector['segCount']
        first_seg = subsector['firstSeg']
        for i in range(seg_count):
            si = first_seg + i
            if si >= len(segs):
                break
            s = segs[si]
            v0 = s['startVertex']
            v1 = s['endVertex']
            if v0 < len(vertices) and v1 < len(vertices):
                x1, y1 = vertices[v0]
                x2, y2 = vertices[v1]
                ET.SubElement(svg, 'line', {
                    'x1': str(x1), 'y1': str(y1),
                    'x2': str(x2), 'y2': str(y2),
                    'stroke': '#000000',
                    'stroke-width': '0.8',
                    'opacity': '0.35'
                })

    # Outline degenerate subsectors in red
    for ss_idx in degenerate_ss:
        seg_count = subsector['segCount'] if 0 else 0
    for ss_idx, subsector in enumerate(subsectors):
        if ss_idx not in degenerate_ss:
            continue
        seg_count = subsector['segCount']
        first_seg = subsector['firstSeg']
        for i in range(seg_count):
            si = first_seg + i
            if si >= len(segs):
                break
            s = segs[si]
            v0 = s['startVertex']
            v1 = s['endVertex']
            if v0 < len(vertices) and v1 < len(vertices):
                x1, y1 = vertices[v0]
                x2, y2 = vertices[v1]
                ET.SubElement(svg, 'line', {
                    'x1': str(x1), 'y1': str(y1),
                    'x2': str(x2), 'y2': str(y2),
                    'stroke': '#ff0000',
                    'stroke-width': '1.6',
                    'opacity': '0.8'
                })

    # Write to file
    tree = ET.ElementTree(svg)
    ET.indent(tree, space='  ')
    tree.write(filename, encoding='utf-8', xml_declaration=True)

    print(f"Exported subsectors to {filename}", file=sys.stderr)


def buildBySubsectors():
    """Build level geometry directly from subsectors - floors/ceilings only, no walls for debugging."""
    ps = parsePlayerStart()
    sectors, sidedefs = parseSectors()

    # Parse BSP subsector data
    segs = parseSegs()
    subsectors = parseSubsectors()

    # Parse vertices and linedefs
    from ByteTools import ByteTools

    vertex_stream = open('wad/VERTEXES.lmp', 'rb')
    vert = ByteTools(vertex_stream)
    vertices = []
    while True:
        try:
            vertices.append((vert.parseInt16(), vert.parseInt16()))
        except IOError:
            break
    vertex_stream.close()

    linedef_stream = open('wad/LINEDEFS.lmp', 'rb')
    lined = ByteTools(linedef_stream)
    linedefs = []
    while True:
        try:
            linedefs.append({
                'v1': lined.parseUInt16(),
                'v2': lined.parseUInt16(),
                'flags': lined.parseUInt16(),
                'type': lined.parseUInt16(),
                'tag': lined.parseUInt16(),
                'side1': lined.parseUInt16(),
                'side2': lined.parseUInt16(),
            })
        except IOError:
            break
    linedef_stream.close()

    # Use indexed sidedefs directly (linedef side indices refer to this list)
    print(f"Parsed {len(vertices)} vertices, {len(linedefs)} linedefs, {len(sidedefs)} sidedefs, {len(sectors)} sectors")
    print(f"Parsed {len(subsectors)} subsectors, {len(segs)} segs")

    # Export to SVG for visualization (hull-ordered), write to a new filename
    export_subsectors_to_svg(subsectors, segs, vertices, sectors, sidedefs, linedefs, 'subsectors_debug_hull.svg')

    px, py = ps
    if px is None or py is None:
        px, py = (0, 0)

    import sys
    print(f"Player start: px={px}, py={py}, After OFFSET: ({px + OFFSET}, {py + OFFSET})", file=sys.stderr)

    brushes = []
    minx = 1e9
    miny = 1e9
    maxx = -1e9
    maxy = -1e9
    minz = 1e9
    maxz = -1e9
    first_floor = None

    slab = 8  # Floor/ceiling thickness

    skipped_count = 0
    skipped_reasons = {'no_sector': 0, 'not_enough_verts': 0, 'invalid_sector': 0, 'no_height': 0}

    # Process each subsector directly
    for ss_idx, subsector in enumerate(subsectors):
        seg_count = subsector['segCount']
        first_seg = subsector['firstSeg']

        # Extract vertices from this subsector's segs
        # Collect both start and end vertices; compute convex hull for stable ordering
        pts = []
        sector_idx = None

        # Collect candidate sectors for majority vote
        sector_counts = {}

        for i in range(seg_count):
            seg_idx = first_seg + i
            if seg_idx >= len(segs):
                break

            seg = segs[seg_idx]
            v_start_idx = seg['startVertex']
            v_end_idx = seg['endVertex']

            if v_start_idx >= len(vertices):
                continue
            if v_end_idx < len(vertices):
                pts.append(vertices[v_end_idx])
            pts.append(vertices[v_start_idx])

            # Tally candidate sectors from both sides of each linedef
            linedef_idx = seg['linedef']
            if linedef_idx != 65535 and linedef_idx < len(linedefs):
                linedef = linedefs[linedef_idx]
                for side_idx in (linedef['side1'], linedef['side2']):
                    if side_idx != 65535 and side_idx < len(sidedefs):
                        sidx = sidedefs[side_idx]['sector']
                        sector_counts[sidx] = sector_counts.get(sidx, 0) + 1

        # Choose majority sector if any candidates were found
        if sector_counts:
            sector_idx = max(sector_counts.items(), key=lambda kv: kv[1])[0]
        else:
            print(f"WARNING: Subsector {ss_idx} has no valid sector candidates (seg_count={seg_count})", file=sys.stderr)

        # Build polygon via convex hull (subsectors are convex)
        poly_vertices = convex_hull(pts)

        if len(poly_vertices) < 3:
            # Fallback: emit thin strips along segs to avoid visible gaps
            print(f"WARNING: Subsector {ss_idx} has only {len(poly_vertices)} hull vertices (seg_count={seg_count})", file=sys.stderr)

            # Decide sector if possible
            if 'sector_counts' in locals() and sector_counts:
                sector_idx = max(sector_counts.items(), key=lambda kv: kv[1])[0]
            if sector_idx is None or sector_idx >= len(sectors):
                skipped_count += 1
                skipped_reasons['not_enough_verts'] += 1
                continue

            sector = sectors[sector_idx]
            floor = sector['heightFloor']
            ceil = sector['heightCeil']
            if ceil <= floor:
                skipped_count += 1
                skipped_reasons['no_height'] += 1
                continue

            def seg_strip(p1, p2, width):
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                L = math.hypot(dx, dy)
                if L < 1e-6:
                    return None
                nx = dy / L
                ny = -dx / L
                hw = width * 0.5
                a = (p1[0] + nx * hw, p1[1] + ny * hw)
                b = (p1[0] - nx * hw, p1[1] - ny * hw)
                c = (p2[0] - nx * hw, p2[1] - ny * hw)
                d = (p2[0] + nx * hw, p2[1] + ny * hw)
                return [a, b, c, d]

            strip_width = 8.0
            floor_slab = 8
            for i in range(seg_count):
                seg_idx = first_seg + i
                if seg_idx >= len(segs):
                    break
                seg = segs[seg_idx]
                v0 = seg['startVertex']
                v1 = seg['endVertex']
                if v0 >= len(vertices) or v1 >= len(vertices):
                    continue
                p1 = vertices[v0]
                p2 = vertices[v1]
                rect = seg_strip(p1, p2, strip_width)
                if not rect:
                    continue
                poly = [(x + OFFSET, y + OFFSET) for (x, y) in rect]
                floor_brushes = generateCutRectSector(poly, floor - floor_slab, floor_slab, comment=f'// Subsector {ss_idx} seg-strip floor')
                ceil_brushes = generateCutRectSector(poly, ceil, floor_slab, comment=f'// Subsector {ss_idx} seg-strip ceiling')
                for br in floor_brushes or []:
                    brushes.append(br)
                for br in ceil_brushes or []:
                    brushes.append(br)
                for px_coord, py_coord in poly:
                    if px_coord < minx: minx = px_coord
                    if px_coord > maxx: maxx = px_coord
                    if py_coord < miny: miny = py_coord
                    if py_coord > maxy: maxy = py_coord

            if first_floor is None:
                first_floor = floor
            if floor < minz: minz = floor
            if ceil > maxz: maxz = ceil

            # Count as processed even if strips only
            continue

        # Skip if we couldn't determine sector or don't have enough vertices
        if sector_idx is None:
            print(f"SKIP: Subsector {ss_idx} has no sector (hull verts={len(poly_vertices)})", file=sys.stderr)
            skipped_count += 1
            skipped_reasons['no_sector'] += 1
            continue

        if sector_idx >= len(sectors):
            print(f"SKIP: Subsector {ss_idx} has invalid sector {sector_idx} >= {len(sectors)}", file=sys.stderr)
            skipped_count += 1
            skipped_reasons['invalid_sector'] += 1
            continue

        if len(poly_vertices) < 3:
            print(f"SKIP: Subsector {ss_idx} still has < 3 vertices after strip fallback", file=sys.stderr)
            skipped_count += 1
            skipped_reasons['not_enough_verts'] += 1
            continue

        sector = sectors[sector_idx]
        floor = sector['heightFloor']
        ceil = sector['heightCeil']

        if ceil <= floor:
            print(f"SKIP: Subsector {ss_idx} sector {sector_idx} has invalid height floor={floor} ceil={ceil}", file=sys.stderr)
            skipped_count += 1
            skipped_reasons['no_height'] += 1
            continue

        # Expand polygon slightly to eliminate gaps
        expanded_poly = expand_polygon(poly_vertices, 0.5)

        # Apply offset
        poly = [(x + OFFSET, y + OFFSET) for (x, y) in expanded_poly]

        # Generate floor and ceiling brushes for this subsector
        floor_brushes = generateCutRectSector(poly, floor - slab, slab, comment=f'// Subsector {ss_idx} floor (sector {sector_idx})')
        ceil_brushes = generateCutRectSector(poly, ceil, slab, comment=f'// Subsector {ss_idx} ceiling (sector {sector_idx})')

        if floor_brushes:
            brushes.extend(floor_brushes)
            print(f"Subsector {ss_idx}: added {len(floor_brushes)} floor brushes (sector {sector_idx}, z={floor-slab}, h={slab})", file=sys.stderr)
        if ceil_brushes:
            brushes.extend(ceil_brushes)
            print(f"Subsector {ss_idx}: added {len(ceil_brushes)} ceiling brushes (sector {sector_idx}, z={ceil}, h={slab})", file=sys.stderr)

        # Update bounds
        for px_coord, py_coord in poly:
            if px_coord < minx: minx = px_coord
            if px_coord > maxx: maxx = px_coord
            if py_coord < miny: miny = py_coord
            if py_coord > maxy: maxy = py_coord

        if first_floor is None:
            first_floor = floor
        if floor < minz: minz = floor
        if ceil > maxz: maxz = ceil

    print(f"\nSubsector processing stats:", file=sys.stderr)
    print(f"  Total subsectors: {len(subsectors)}", file=sys.stderr)
    print(f"  Processed: {len(subsectors) - skipped_count}", file=sys.stderr)
    print(f"  Skipped: {skipped_count}", file=sys.stderr)
    if skipped_count > 0:
        print(f"    No sector: {skipped_reasons['no_sector']}", file=sys.stderr)
        print(f"    Not enough verts: {skipped_reasons['not_enough_verts']}", file=sys.stderr)
        print(f"    Invalid sector: {skipped_reasons['invalid_sector']}", file=sys.stderr)
        print(f"    No height: {skipped_reasons['no_height']}", file=sys.stderr)

    if minx == 1e9:
        minx, miny, maxx, maxy, minz, maxz = -4096, -4096, 4096, 4096, -1024, 1024

    # Debug: print bounds
    print(f"Map bounds: x=[{minx}, {maxx}], y=[{miny}, {maxy}], z=[{minz}, {maxz}]", file=sys.stderr)
    print(f"Total brushes before walls: {len(brushes)}", file=sys.stderr)

    # Generate walls from linedefs
    print(f"\nGenerating walls from linedefs...", file=sys.stderr)
    seen_linedefs = set()
    wall_count = 0

    for linedef_idx, linedef in enumerate(linedefs):
        if linedef_idx in seen_linedefs:
            continue
        seen_linedefs.add(linedef_idx)

        v1 = (vertices[linedef['v1']][0] + OFFSET, vertices[linedef['v1']][1] + OFFSET)
        v2 = (vertices[linedef['v2']][0] + OFFSET, vertices[linedef['v2']][1] + OFFSET)

        side1_idx = linedef['side1']
        side2_idx = linedef['side2']

        # One-sided linedef: create full wall
        if side2_idx == 65535:
            if side1_idx != 65535 and side1_idx < len(sidedefs):
                sector_idx = sidedefs[side1_idx]['sector']
                if sector_idx < len(sectors):
                    sector = sectors[sector_idx]
                    floor = sector['heightFloor']
                    ceil = sector['heightCeil']
                    if ceil > floor:
                        brushes.append(generateLine(v1, v2, (floor, ceil), drawpoints=False))
                        wall_count += 1
        # Two-sided linedef: check for height differences
        else:
            if side1_idx != 65535 and side1_idx < len(sidedefs) and side2_idx < len(sidedefs):
                sector1_idx = sidedefs[side1_idx]['sector']
                sector2_idx = sidedefs[side2_idx]['sector']

                if sector1_idx < len(sectors) and sector2_idx < len(sectors):
                    sector1 = sectors[sector1_idx]
                    sector2 = sectors[sector2_idx]

                    floor1 = sector1['heightFloor']
                    ceil1 = sector1['heightCeil']
                    floor2 = sector2['heightFloor']
                    ceil2 = sector2['heightCeil']

                    # Create lower wall if floors differ
                    if floor1 != floor2:
                        min_floor = min(floor1, floor2)
                        max_floor = max(floor1, floor2)
                        brushes.append(generateLine(v1, v2, (min_floor, max_floor), drawpoints=False))
                        wall_count += 1

                    # Create upper wall if ceilings differ
                    if ceil1 != ceil2:
                        min_ceil = min(ceil1, ceil2)
                        max_ceil = max(ceil1, ceil2)
                        brushes.append(generateLine(v1, v2, (min_ceil, max_ceil), drawpoints=False))
                        wall_count += 1

    print(f"Generated {wall_count} wall brushes from {len(linedefs)} linedefs", file=sys.stderr)
    print(f"Total brushes before sealing: {len(brushes)}", file=sys.stderr)

    # Create sealed box around the level
    margin = 256
    box_minx = minx - margin
    box_miny = miny - margin
    box_minz = minz - margin
    box_maxx = maxx + margin
    box_maxy = maxy + margin
    box_maxz = maxz + margin

    wall_thickness = 64

    print(f"Creating sealed box: x=[{box_minx}, {box_maxx}], y=[{box_miny}, {box_maxy}], z=[{box_minz}, {box_maxz}]", file=sys.stderr)

    # Create 6 solid walls
    brushes.append(generateRect3d((box_minx, box_miny, box_minz),
                                   (wall_thickness, box_maxy - box_miny, box_maxz - box_minz),
                                   comment="// Seal: West wall"))
    brushes.append(generateRect3d((box_maxx - wall_thickness, box_miny, box_minz),
                                   (wall_thickness, box_maxy - box_miny, box_maxz - box_minz),
                                   comment="// Seal: East wall"))
    brushes.append(generateRect3d((box_minx, box_miny, box_minz),
                                   (box_maxx - box_minx, wall_thickness, box_maxz - box_minz),
                                   comment="// Seal: South wall"))
    brushes.append(generateRect3d((box_minx, box_maxy - wall_thickness, box_minz),
                                   (box_maxx - box_minx, wall_thickness, box_maxz - box_minz),
                                   comment="// Seal: North wall"))
    brushes.append(generateRect3d((box_minx, box_miny, box_minz),
                                   (box_maxx - box_minx, box_maxy - box_miny, wall_thickness),
                                   comment="// Seal: Bottom"))
    brushes.append(generateRect3d((box_minx, box_miny, box_maxz - wall_thickness),
                                   (box_maxx - box_minx, box_maxy - box_miny, wall_thickness),
                                   comment="// Seal: Top"))

    print(f"Total brushes after sealing: {len(brushes)}", file=sys.stderr)

    pz = (first_floor if first_floor is not None else 0) + 16

    with open('doom2doom3.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, (px + OFFSET, py + OFFSET, pz)))

    print(f"\nGenerated {len(brushes)} total brushes from {len(subsectors)} subsectors")
    print(f"Map saved to doom2doom3.map")

def main():
    buildBySubsectors()
    # buildBySectors()
    # buildTestSingleSector()

def group_subsectors_by_sector(subsectors, segs, linedefs, sidedefs, vertices):
    """Group subsectors by their parent sector.

    Returns a dict: {sector_index: [list of subsector polygons]}
    Each subsector polygon is a list of (x, y) vertex coordinates in order.
    """
    sector_subsectors = {}
    failed_subsectors = []

    # Build a list of sidedefs for each linedef direction
    linedef_sides = {}
    for sidedef_idx, sidedef in enumerate(sidedefs):
        sector_idx = sidedef['sector']
        # Track which sidedefs belong to which sectors
        if sector_idx not in linedef_sides:
            linedef_sides[sector_idx] = []
        linedef_sides[sector_idx].append(sidedef_idx)

    for ss_idx, subsector in enumerate(subsectors):
        seg_count = subsector['segCount']
        first_seg = subsector['firstSeg']

        # Extract vertices from this subsector's segs
        poly_vertices = []
        sector_candidates = []

        for i in range(seg_count):
            if first_seg + i >= len(segs):
                break

            seg = segs[first_seg + i]
            v_idx = seg['startVertex']

            if v_idx >= len(vertices):
                continue

            poly_vertices.append(vertices[v_idx])

            # Determine which sector this subsector belongs to
            linedef_idx = seg['linedef']
            if linedef_idx < len(linedefs):
                linedef = linedefs[linedef_idx]

                # Try both sides to find a valid sidedef
                for side_idx in [linedef['side1'], linedef['side2']]:
                    if side_idx != 65535 and side_idx < len(sidedefs):
                        sector_idx = sidedefs[side_idx]['sector']
                        if sector_idx not in sector_candidates:
                            sector_candidates.append(sector_idx)

        # Choose the most common sector candidate
        sector_idx = None
        if sector_candidates:
            # Use the first (most frequently encountered) candidate
            sector_idx = sector_candidates[0]

        # Add this subsector polygon to its parent sector
        if sector_idx is not None and len(poly_vertices) >= 3:
            if sector_idx not in sector_subsectors:
                sector_subsectors[sector_idx] = []
            sector_subsectors[sector_idx].append(poly_vertices)
        else:
            failed_subsectors.append((ss_idx, len(poly_vertices), sector_idx))

    if failed_subsectors:
        missing_verts = len([x for x in failed_subsectors if x[1] < 3])
        print(f"WARNING: {len(failed_subsectors)} subsectors failed (missing {missing_verts} with <3 verts, {len(failed_subsectors) - missing_verts} with no sector)")

    return sector_subsectors

def buildBySectors():
    ps = parsePlayerStart()
    sectors, sidedefs = parseSectors()

    # Parse BSP subsector data
    try:
        segs = parseSegs()
        subsectors = parseSubsectors()
        # We also need vertices and linedefs for subsector processing
        from wadparser import parseSectors as parseSectorsRaw
        # Need to get vertices and linedefs - let me extract from existing parseSectors
        vertices = []
        linedefs = []
        # Parse them manually for now
        from ByteTools import ByteTools

        vertex_stream = open('wad/VERTEXES.lmp', 'rb')
        vert = ByteTools(vertex_stream)
        while True:
            try:
                vertices.append((vert.parseInt16(), vert.parseInt16()))
            except IOError:
                break
        vertex_stream.close()

        linedef_stream = open('wad/LINEDEFS.lmp', 'rb')
        lined = ByteTools(linedef_stream)
        while True:
            try:
                linedefs.append({
                    'v1': lined.parseUInt16(),
                    'v2': lined.parseUInt16(),
                    'flags': lined.parseUInt16(),
                    'type': lined.parseUInt16(),
                    'tag': lined.parseUInt16(),
                    'side1': lined.parseUInt16(),
                    'side2': lined.parseUInt16(),
                })
            except IOError:
                break
        linedef_stream.close()

        # Get sidedef list
        sidedef_list = []
        for sector in sectors:
            if 'sidedefs' in sector:
                for sidedef in sector['sidedefs']:
                    sidedef_list.append(sidedef)

        sector_subsectors = group_subsectors_by_sector(subsectors, segs, linedefs, sidedef_list, vertices)
        use_subsectors = True  # Re-enabled - fallback fails on non-convex sectors
        print(f"Successfully parsed {len(subsectors)} subsectors, grouped into {len(sector_subsectors)} sectors")
    except Exception as e:
        print(f"WARNING: Failed to parse subsectors ({e}), falling back to polygon ordering")
        sector_subsectors = {}
        use_subsectors = False

    px, py = ps
    if px is None or py is None:
        px, py = (0, 0)

    import sys
    print(f"Player start: px={px}, py={py}, After OFFSET: ({px + OFFSET}, {py + OFFSET})", file=sys.stderr)

    brushes = []

    minx = 1e9
    miny = 1e9
    maxx = -1e9
    maxy = -1e9
    minz = 1e9
    maxz = -1e9
    first_floor = None

    # First pass: generate floor/ceiling geometry for each sector
    linedef_to_sectors = {}  # (v1, v2) -> [(floor, ceil), ...]

    for sector_idx, sector in enumerate(sectors):
        if 'sidedefs' not in sector or not sector['sidedefs']:
            continue

        floor, ceil = sector['heightFloor'], sector['heightCeil']
        if ceil <= floor:
            continue

        edges = []
        linedefs = []
        seen_linedefs = set()
        for sidedef in sector['sidedefs']:
            if 'linedefs' not in sidedef:
                continue
            for linedef in sidedef['linedefs']:
                linedef_key = (linedef['v1'], linedef['v2'])
                if linedef_key in seen_linedefs:
                    continue
                seen_linedefs.add(linedef_key)

                edges.append((linedef['vertex1'], linedef['vertex2']))
                linedefs.append(linedef)

                # Track which sectors each linedef connects
                key = tuple(sorted([linedef['vertex1'], linedef['vertex2']]))
                if key not in linedef_to_sectors:
                    linedef_to_sectors[key] = []
                linedef_to_sectors[key].append((floor, ceil))

        # Use subsectors if available, otherwise fall back to polygon ordering
        slab = 8

        if use_subsectors and sector_idx in sector_subsectors:
            # Use pre-computed convex subsector polygons
            for subsector_poly in sector_subsectors[sector_idx]:
                # Expand polygon by 0.5 units to eliminate gaps between adjacent subsectors
                expanded_poly = expand_polygon(subsector_poly, 0.5)

                # Apply offset
                poly = [(x + OFFSET, y + OFFSET) for (x, y) in expanded_poly]

                # Generate floor and ceiling for this convex subsector
                # NOTE: floor is below actual floor height, ceiling is above actual ceiling height
                floor_brushes = generateCutRectSector(poly, floor - slab, slab, comment=f'// Sector {sector_idx} subsector floor')
                ceil_brushes = generateCutRectSector(poly, ceil, slab, comment=f'// Sector {sector_idx} subsector ceiling')

                if floor_brushes:
                    for brush in floor_brushes:
                        brushes.append(brush)
                        import sys
                        print(f"Brush {len(brushes)-1}: Sector {sector_idx} subsector floor z={floor-slab} h={slab}", file=sys.stderr)
                if ceil_brushes:
                    for brush in ceil_brushes:
                        brushes.append(brush)
                        import sys
                        print(f"Brush {len(brushes)-1}: Sector {sector_idx} subsector ceiling z={ceil} h={slab}", file=sys.stderr)

                # Update bounds
                for px, py in poly:
                    if px < minx: minx = px
                    if px > maxx: maxx = px
                    if py < miny: miny = py
                    if py > maxy: maxy = py

            if first_floor is None:
                first_floor = floor
            if floor < minz: minz = floor
            if ceil > maxz: maxz = ceil
            continue

        # Fallback: use original polygon ordering approach
        poly = order_polygon(edges)
        if len(poly) < 3:
            print(f"WARNING: Sector {sector_idx} has invalid polygon (< 3 vertices), using bounding box fallback")
            # Use bounding box fallback for sectors with broken polygon ordering
            if len(edges) > 0:
                verts = []
                for e1, e2 in edges:
                    verts.append(e1)
                    verts.append(e2)
                if len(verts) >= 3:
                    minx_p = min(v[0] for v in verts)
                    maxx_p = max(v[0] for v in verts)
                    miny_p = min(v[1] for v in verts)
                    maxy_p = max(v[1] for v in verts)

                    slab = 8
                    brushes.append(generateRect3d((minx_p + OFFSET, miny_p + OFFSET, floor - slab), (maxx_p - minx_p, maxy_p - miny_p, slab)))
                    brushes.append(generateRect3d((minx_p + OFFSET, miny_p + OFFSET, ceil), (maxx_p - minx_p, maxy_p - miny_p, slab)))

                    if first_floor is None:
                        first_floor = floor

                    if minx_p < minx: minx = minx_p
                    if maxx_p > maxx: maxx = maxx_p
                    if miny_p < miny: miny = miny_p
                    if maxy_p > maxy: maxy = maxy_p
                    if floor < minz: minz = floor
                    if ceil > maxz: maxz = ceil
            continue

        poly = [(x + OFFSET, y + OFFSET) for (x, y) in poly]
        tris = triangulate(poly)

        if not tris:
            print(f"WARNING: Sector {sector_idx} triangulation failed, using bounding box fallback")
            # Triangulation failed - create bounding box fallback
            minx_p = min(p[0] for p in poly)
            maxx_p = max(p[0] for p in poly)
            miny_p = min(p[1] for p in poly)
            maxy_p = max(p[1] for p in poly)

            slab = 8
            # Create floor and ceiling slabs from bounding box
            brushes.append(generateRect3d((minx_p, miny_p, floor - slab), (maxx_p - minx_p, maxy_p - miny_p, slab)))
            brushes.append(generateRect3d((minx_p, miny_p, ceil), (maxx_p - minx_p, maxy_p - miny_p, slab)))

            if first_floor is None:
                first_floor = floor

            if minx_p < minx: minx = minx_p
            if maxx_p > maxx: maxx = maxx_p
            if miny_p < miny: miny = miny_p
            if maxy_p > maxy: maxy = maxy_p
            if floor < minz: minz = floor
            if ceil > maxz: maxz = ceil
            continue

        # Use cutting planes for proper sector shapes, fallback to bounding box if needed
        slab = 8
        floor_brushes = generateCutRectSector(poly, floor - slab, slab, comment=f'// Sector {sector_idx} floor')
        ceil_brushes = generateCutRectSector(poly, ceil, slab, comment=f'// Sector {sector_idx} ceiling')

        # Fallback to bounding box if cutting planes failed
        if not floor_brushes or not ceil_brushes:
            for brush in floor_brushes or []:
                brushes.append(brush)
                import sys
                print(f"Brush {len(brushes)-1}: Sector {sector_idx} FALLBACK floor z={floor-slab} h={slab}", file=sys.stderr)
            for brush in ceil_brushes or []:
                brushes.append(brush)
                import sys
                print(f"Brush {len(brushes)-1}: Sector {sector_idx} FALLBACK ceiling z={ceil} h={slab}", file=sys.stderr)
        if not floor_brushes or not ceil_brushes:
            minx_p = min(p[0] for p in poly)
            maxx_p = max(p[0] for p in poly)
            miny_p = min(p[1] for p in poly)
            maxy_p = max(p[1] for p in poly)

            if not floor_brushes:
                brushes.append(generateRect3d((minx_p, miny_p, floor - slab), (maxx_p - minx_p, maxy_p - miny_p, slab), comment=f'// Sector {sector_idx} floor'))
            else:
                brushes.extend(floor_brushes)

            if not ceil_brushes:
                brushes.append(generateRect3d((minx_p, miny_p, ceil), (maxx_p - minx_p, maxy_p - miny_p, slab), comment=f'// Sector {sector_idx} ceiling'))
            else:
                brushes.extend(ceil_brushes)
        else:
            brushes.extend(floor_brushes)
            brushes.extend(ceil_brushes)

        if first_floor is None:
            first_floor = floor

        for p in poly:
            if p[0] < minx: minx = p[0]
            if p[0] > maxx: maxx = p[0]
            if p[1] < miny: miny = p[1]
            if p[1] > maxy: maxy = p[1]
        if floor < minz: minz = floor
        if ceil > maxz: maxz = ceil

    # Second pass: generate walls for linedefs
    # Create walls for one-sided linedefs and step walls for height differences
    seen = set()

    # Need to access all linedefs with their sidedef info
    # We'll collect them from sectors but track which have been processed
    for sector in sectors:
        if 'sidedefs' not in sector or not sector['sidedefs']:
            continue

        sector_floor = sector['heightFloor']
        sector_ceil = sector['heightCeil']

        for sidedef in sector['sidedefs']:
            if 'linedefs' not in sidedef:
                continue
            for linedef in sidedef['linedefs']:
                key = tuple(sorted([linedef['vertex1'], linedef['vertex2']]))
                if key in seen:
                    continue
                seen.add(key)

                v1 = (linedef['vertex1'][0] + OFFSET, linedef['vertex1'][1] + OFFSET)
                v2 = (linedef['vertex2'][0] + OFFSET, linedef['vertex2'][1] + OFFSET)

                # One-sided linedefs: create full wall
                if linedef['side2'] == 65535:
                    brushes.append(generateLine(v1, v2, (sector_floor, sector_ceil), drawpoints=False))
                # Two-sided linedefs: compare front and back sectors
                else:
                    # Get front sector (current sector)
                    front_floor = sector_floor
                    front_ceil = sector_ceil

                    # Get back sector using side2 index
                    back_sidedef = sidedefs[linedef['side2']]
                    back_sector = sectors[back_sidedef['sector']]
                    back_floor = back_sector['heightFloor']
                    back_ceil = back_sector['heightCeil']

                    # Create lower wall if floors differ
                    if front_floor != back_floor:
                        min_floor = min(front_floor, back_floor)
                        max_floor = max(front_floor, back_floor)
                        brushes.append(generateLine(v1, v2, (min_floor, max_floor), drawpoints=False))

                    # Create upper wall if ceilings differ
                    if front_ceil != back_ceil:
                        min_ceil = min(front_ceil, back_ceil)
                        max_ceil = max(front_ceil, back_ceil)
                        brushes.append(generateLine(v1, v2, (min_ceil, max_ceil), drawpoints=False))

    if minx == 1e9:
        minx, miny, maxx, maxy, minz, maxz = -4096, -4096, 4096, 4096, -1024, 1024

    # Debug: print bounds
    import sys
    print(f"Map bounds: x=[{minx}, {maxx}], y=[{miny}, {maxy}], z=[{minz}, {maxz}]", file=sys.stderr)
    print(f"Total brushes before sealing: {len(brushes)}", file=sys.stderr)

    # Create a simple sealed box for visual debugging
    # Large margin to ensure we enclose everything
    margin = 256
    box_minx = minx - margin
    box_miny = miny - margin
    box_minz = minz - margin
    box_maxx = maxx + margin
    box_maxy = maxy + margin
    box_maxz = maxz + margin

    wall_thickness = 64

    print(f"Creating sealed box: x=[{box_minx}, {box_maxx}], y=[{box_miny}, {box_maxy}], z=[{box_minz}, {box_maxz}]", file=sys.stderr)

    # Create 6 solid walls (one huge brush per wall)
    # Left wall (west)
    brushes.append(generateRect3d((box_minx, box_miny, box_minz),
                                   (wall_thickness, box_maxy - box_miny, box_maxz - box_minz),
                                   comment="// Seal: West wall"))
    # Right wall (east)
    brushes.append(generateRect3d((box_maxx - wall_thickness, box_miny, box_minz),
                                   (wall_thickness, box_maxy - box_miny, box_maxz - box_minz),
                                   comment="// Seal: East wall"))
    # Front wall (south)
    brushes.append(generateRect3d((box_minx, box_miny, box_minz),
                                   (box_maxx - box_minx, wall_thickness, box_maxz - box_minz),
                                   comment="// Seal: South wall"))
    # Back wall (north)
    brushes.append(generateRect3d((box_minx, box_maxy - wall_thickness, box_minz),
                                   (box_maxx - box_minx, wall_thickness, box_maxz - box_minz),
                                   comment="// Seal: North wall"))
    # Bottom (floor)
    brushes.append(generateRect3d((box_minx, box_miny, box_minz),
                                   (box_maxx - box_minx, box_maxy - box_miny, wall_thickness),
                                   comment="// Seal: Bottom"))
    # Top (ceiling)
    brushes.append(generateRect3d((box_minx, box_miny, box_maxz - wall_thickness),
                                   (box_maxx - box_minx, box_maxy - box_miny, wall_thickness),
                                   comment="// Seal: Top"))

    print(f"Total brushes after sealing: {len(brushes)}", file=sys.stderr)

    pz = (first_floor if first_floor is not None else 0) + 16

    with open('doom2doom3.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, (px + OFFSET, py + OFFSET, pz)))

    print(f"\nGenerated {len(brushes)} total brushes from {len(subsectors)} subsectors")
    print(f"Map saved to doom2doom3.map")

def getBorders(lines: list) -> list:
    ''' [(minx, miny), (maxx, maxy)] '''

    minx = 99999
    miny = 99999
    maxx = -99999
    maxy = -99999

    for line in lines:
        if line[0][0] < minx: minx = line[0][0]
        if line[0][0] > maxx: maxx = line[0][0]

        if line[1][0] < minx: minx = line[1][0]
        if line[1][0] > maxx: maxx = line[1][0]

        if line[0][1] < miny: miny = line[0][1]
        if line[0][1] > maxy: maxy = line[0][1]

        if line[1][1] < miny: miny = line[1][1]
        if line[1][1] > maxy: maxy = line[1][1]

    return [(minx, miny), (maxx, maxy)]


def buildByLines():
    lines = parseLines()

    safelines = []

    for line in lines:
        if line[0][0] == line[1][0] or line[0][1] == line[1][1]:
            safelines.append(line)

    brushes = []

    # pointMin = [9999, 9999]
    # pointMax = [-9999, -9999]
    # heightMinMax = [9999, -9999]

    for line in safelines:
        # for vert in line[0:2]:
            # if vert[0] < pointMin[0]: pointMin[0] = vert[0]
            # if vert[0] > pointMax[0]: pointMax[0] = vert[0]
            # if vert[1] < pointMin[1]: pointMin[1] = vert[1]
            # if vert[1] > pointMax[1]: pointMax[1] = vert[1]

        # if line[2][0] < heightMinMax[0]: heightMinMax[0] = line[2][0]
        # if line[2][0] > heightMinMax[1]: heightMinMax[1] = line[2][0]
        # if line[2][1] < heightMinMax[0]: heightMinMax[0] = line[2][1]
        # if line[2][1] > heightMinMax[1]: heightMinMax[1] = line[2][1]

        brushes.append(generateSafeLine((line[0][0] + OFFSET, line[0][1] + OFFSET), (line[1][0] + OFFSET, line[1][1] + OFFSET), line[2]))

    # brushes.append(generateBox(pointMin[0], pointMin[1], heightMinMax[0], max(pointMax[0], pointMax[1], heightMinMax[1])))
    brushes.append(generateBox(0, 0, -16, 5000))

    with open('doom2doom3.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, (1987, 2037, 8))) #(0, 0, 8)))

if __name__ == "__main__":
    main()