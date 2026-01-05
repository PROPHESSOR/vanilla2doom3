from wadparser import parseLines, parseSectors, parsePlayerStart
from genblock import generateRect3d, generateMapFromBrushes, generateSafeLine, generateLine, generateBox, generateTriPrism

OFFSET = 2000


def polygon_area(poly):
    area = 0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        area += x1 * y2 - x2 * y1
    return area / 2


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

def buildBySectors():
    ps = parsePlayerStart()
    sectors, sidedefs = parseSectors()
    px, py = ps
    if px is None or py is None:
        px, py = (0, 0)
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

        # DISABLED: Triangular prism generation causes backwards triangles and dmap hangs
        # For now, use bounding box for all sectors to avoid problematic geometry
        slab = 8
        minx_p = min(p[0] for p in poly)
        maxx_p = max(p[0] for p in poly)
        miny_p = min(p[1] for p in poly)
        maxy_p = max(p[1] for p in poly)

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

    # Add outer sealing layer - simple thick walls around the entire map
    seal_width = 128

    # Extend beyond all geometry
    outer_minx = minx - seal_width
    outer_miny = miny - seal_width
    outer_maxx = maxx + seal_width
    outer_maxy = maxy + seal_width
    outer_minz = minz - seal_width
    outer_maxz = maxz + seal_width

    # Create 6 solid sealing brushes (one for each side of the bounding box)
    brushes.append(generateRect3d((outer_minx, outer_miny, outer_minz),
                                   (seal_width, outer_maxy - outer_miny, outer_maxz - outer_minz)))  # left
    brushes.append(generateRect3d((outer_maxx - seal_width, outer_miny, outer_minz),
                                   (seal_width, outer_maxy - outer_miny, outer_maxz - outer_minz)))  # right
    brushes.append(generateRect3d((outer_minx, outer_miny, outer_minz),
                                   (outer_maxx - outer_minx, seal_width, outer_maxz - outer_minz)))  # front
    brushes.append(generateRect3d((outer_minx, outer_maxy - seal_width, outer_minz),
                                   (outer_maxx - outer_minx, seal_width, outer_maxz - outer_minz)))  # back
    brushes.append(generateRect3d((outer_minx, outer_miny, outer_minz),
                                   (outer_maxx - outer_minx, outer_maxy - outer_miny, seal_width)))  # floor
    brushes.append(generateRect3d((outer_minx, outer_miny, outer_maxz - seal_width),
                                   (outer_maxx - outer_minx, outer_maxy - outer_miny, seal_width)))  # ceiling

    pz = (first_floor if first_floor is not None else 0) + 16

    with open('doom2doom3.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, (px + OFFSET, py + OFFSET, pz)))

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