from wadparser import parseLines, parseSectors, parsePlayerStart, parseSegs, parseSubsectors
from genblock import generateRect3d, generateMapFromBrushes, generateSafeLine, generateLine, generateBox, generateTriPrism, generateCutRectSector
import math

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


def main():
    buildBySectors()
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
        _out.write(generateMapFromBrushes(brushes, (px, py, pz)))

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