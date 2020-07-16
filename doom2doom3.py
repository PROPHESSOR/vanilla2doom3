from wadparser import parseLines, parseSectors
from genblock import generateRect3d, generateMapFromBrushes, generateSafeLine, generateBox

def main():
    buildBySectors()

def buildBySectors():
    ps = [0, 0, 0]
    sectors = parseSectors()

    safesectors = sectors

    # for sector in sectors:
    #     linedefs = []

    #     for sidedef in sector['sidedefs']:
    #         if not 'linedefs' in sidedef: break

    #         for linedef in sidedef['linedefs']:
    #             if not linedef in linedefs:
    #                 linedefs.append(linedef)
        
    #     if len(linedefs) == 4:
    #         safesectors.append(sector)

    # print(f'Removed {len(sectors) - len(safesectors)} unsafe sectors (now there are {len(safesectors)} safe sectors)')

    brushes = []

    # pointMin = [9999, 9999]
    # pointMax = [-9999, -9999]
    # heightMinMax = [9999, -9999]

    for sector in safesectors:
        # for vert in line[0:2]:
            # if vert[0] < pointMin[0]: pointMin[0] = vert[0]
            # if vert[0] > pointMax[0]: pointMax[0] = vert[0]
            # if vert[1] < pointMin[1]: pointMin[1] = vert[1]
            # if vert[1] > pointMax[1]: pointMax[1] = vert[1]

        # if line[2][0] < heightMinMax[0]: heightMinMax[0] = line[2][0]
        # if line[2][0] > heightMinMax[1]: heightMinMax[1] = line[2][0]
        # if line[2][1] < heightMinMax[0]: heightMinMax[0] = line[2][1]
        # if line[2][1] > heightMinMax[1]: heightMinMax[1] = line[2][1]

        floor, ceil = sector['heightFloor'], sector['heightCeil']

        lines = []

        for sidedef in sector['sidedefs']:
            if not 'linedefs' in sidedef: continue

            for linedef in sidedef['linedefs']:
                lines.append(((linedef['vertex1'][0] + 2000, linedef['vertex1'][1] + 2000), (linedef['vertex2'][0] + 2000, linedef['vertex2'][1] + 2000)))

        minborder, maxborder = getBorders(lines)

        # ps = [
        #     (maxborder[0] - minborder[0]) / 2 + minborder[0],
        #     (maxborder[1] - minborder[1]) / 2 + minborder[1],
        #     floor,
        # ]

        for line in lines:
            brushes.append(generateSafeLine(line[0], line[1], (floor, ceil)))

        brushes.append(generateRect3d((minborder[0], minborder[1], floor - 8), (maxborder[0] - minborder[0], maxborder[1] - minborder[1], 8)))
        brushes.append(generateRect3d((minborder[0], minborder[1], ceil), (maxborder[0] - minborder[0], maxborder[1] - minborder[1], 8)))

        break # break after first sector to test

    # brushes.append(generateBox(pointMin[0], pointMin[1], heightMinMax[0], max(pointMax[0], pointMax[1], heightMinMax[1])))
    brushes.append(generateBox(0, 0, -16, 5000))

    with open('doom2doom3.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, (1400, 1491, 8)))

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

        brushes.append(generateSafeLine((line[0][0] + 2000, line[0][1] + 2000), (line[1][0] + 2000, line[1][1] + 2000), line[2]))

    # brushes.append(generateBox(pointMin[0], pointMin[1], heightMinMax[0], max(pointMax[0], pointMax[1], heightMinMax[1])))
    brushes.append(generateBox(0, 0, -16, 5000))

    with open('doom2doom3.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, (0, 0, 8)))

if __name__ == "__main__":
    main()