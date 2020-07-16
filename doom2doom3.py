from wadparser import parseLines
from genblock import generateRect3d, generateMapFromBrushes, generateSafeLine, generateBox

def main():
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