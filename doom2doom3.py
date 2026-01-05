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

def main():
    buildBySectors()

def buildBySectors():
    ps = parsePlayerStart()
    sectors = parseSectors()
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

    for sector in sectors:
        if 'sidedefs' not in sector or not sector['sidedefs']:
            continue

        floor, ceil = sector['heightFloor'], sector['heightCeil']
        if ceil <= floor:
            continue

        edges = []
        linedefs = []
        for sidedef in sector['sidedefs']:
            if 'linedefs' not in sidedef:
                continue
            for linedef in sidedef['linedefs']:
                edges.append((linedef['vertex1'], linedef['vertex2']))
                linedefs.append(linedef)

        poly = order_polygon(edges)
        if len(poly) < 3:
            continue

        poly = [(x + OFFSET, y + OFFSET) for (x, y) in poly]
        tris = triangulate(poly)
        if not tris:
            continue

        slab = 8
        for a, b, c in tris:
            if tri_area(a, b, c) == 0:
                continue
            orient = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if orient < 0:
                b, c = c, b
            brushes.append(generateTriPrism(a, b, c, floor - slab, slab))
            brushes.append(generateTriPrism(a, b, c, ceil, slab))

            for p in (a, b, c):
                if p[0] < minx: minx = p[0]
                if p[0] > maxx: maxx = p[0]
                if p[1] < miny: miny = p[1]
                if p[1] > maxy: maxy = p[1]
            if floor < minz: minz = floor
            if ceil > maxz: maxz = ceil

        seen = set()
        for linedef in linedefs:
            # skip two-sided to avoid sealing portals between sectors
            if linedef['side2'] != 65535:
                continue

            key = tuple(sorted([linedef['vertex1'], linedef['vertex2']]))
            if key in seen:
                continue
            seen.add(key)
            v1 = (linedef['vertex1'][0] + OFFSET, linedef['vertex1'][1] + OFFSET)
            v2 = (linedef['vertex2'][0] + OFFSET, linedef['vertex2'][1] + OFFSET)
            brushes.append(generateLine(v1, v2, (floor, ceil), drawpoints=False))

    if minx == 1e9:
        minx, miny, maxx, maxy, minz, maxz = -4096, -4096, 4096, 4096, -1024, 1024

    size_xy = max(maxx - minx, maxy - miny) + 2048
    size_z = (maxz - minz) + 2048
    base_z = minz - 1024
    shell_size = max(size_xy, size_z)
    shell_x = minx - 1024
    shell_y = miny - 1024

    brushes.append(generateBox(shell_x, shell_y, base_z, shell_size))

    with open('doom2doom3.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, (px + OFFSET, py + OFFSET, 8)))

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