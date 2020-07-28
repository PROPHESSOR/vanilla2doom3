#!/usr/bin/python3.7

from geometry import *

TEXTURED = False

def main():
    global TEXTURED
    TEXTURED = False
    playerstart = (32, 32, 16)

    testoffset = 0

    brushes = [
        generatePoint((testoffset + 0, testoffset + 0), 0, width=2), # Zero point

        # XYZ
        generateSafeLine((testoffset + 0, testoffset + 0), (testoffset + 32, testoffset + 0), (0, 1)), # X
        generateSafeLine((testoffset + 0, testoffset + 0), (testoffset + 0, testoffset + 16), (0, 1)), # Y
        generateSafeLine((testoffset + 0, testoffset + 0), (testoffset + 8, testoffset + 0), (0, 32)), # Z

        # generateRect3d((-64, -64, -8), (128, 128, 8)), #bottom
        # generateRect3d((-64 - 8, -64, 0), (8, 128, 128)), #left (player back)
        # generateCube(-64, -192, 0, 128), #front (player right)
        # generateCube(64, -64, 0, 128), #right (player front)
        # generateCube(-64, 64, 0, 128), #back (player left)
        # generateRect3d((-64, -64, 128), (128, 128, 8)), #top
        generateRect3d((256, 256, 256), (128, 128, 1)),
        generateRect3d((256, 256, 270), (128, 128, 1), rotation=45),

        generatePoint((256, 256), 256),
        generatePoint((256 + 128, 256 + 128), 256),

        # generateSafeLine((8, 8), (8, 16)),
        # generateSafeLine((0, 0), (0, 64)),
        # generateSafeLine((0, 0), (64, 0)),

        # generateBox(0, 0, 0, 256),

        # generateLine((0, 0), (32, 32)),

        # generateSafeLine((0, 0), (32, 0)),
        # generateLine((0, 0), (32, 0), (8, 16)),
        # generateLine((0, 0), (32, 32), (16, 24)),
        # generateLine((64, 64), (128, 128)),
        # generateLine((128, 128), (64, 64), (16, 24)),
        # generateLine((128, 64), (64, 128), (8, 16)),

        # generatePoint((0, 0), -64),
        # generatePoint((64, 0), -64),
        # generatePoint((64, 64), -64),
        # generatePoint((0, 64), -64),
        # generatePoint((-64, 0), -64),
        # generatePoint((-64, -64), -64),
        # generatePoint((0, -64), -64),
        # generatePoint((-64, 64), -64),
        # generatePoint((64, -64), -64),

        # generateLine((64, 64), (2000, 2000), drawpoints=True),
        # generateLine((2000, 2000), (2256, 2256), (16, 24), drawpoints=True),

        # generateLine((2048, 1024), (2048, 2048), (-10, -9), drawpoints=True),
        # generateLine((2048, 1024), (2048, 2048), (-10, -9), drawpoints=True),
        # generateLine((2048, 2048), (4096, 2048), (-10, -9), drawpoints=True),
        # generateLine((4096, 2048), (4096, 1024), (-10, -9), drawpoints=True),
        # generateLine((4096, 1024), (2048, 1024), (-10, -9), drawpoints=True),

        # generateSafeLine((testoffset + 0, testoffset + 0), (testoffset + 0, testoffset + 256), (128, 129)),
        # generateSafeLine((testoffset + 0, testoffset + 256), (testoffset + 256, testoffset + 256), (128, 129)),
        # generateSafeLine((testoffset + 256, testoffset + 256), (testoffset + 256, testoffset + 0), (128, 129)),
        # generateSafeLine((testoffset + 256, testoffset + 0), (testoffset + 0, testoffset + 0), (128, 129)),

        # generateLine((testoffset + 0, testoffset + 0), (testoffset + 0, testoffset + 256), (64, 65), drawpoints=False),
        # generateLine((testoffset + 0, testoffset + 256), (testoffset + 256, testoffset + 256), (64, 65), drawpoints=False),
        # generateLine((testoffset + 256, testoffset + 256), (testoffset + 256, testoffset + 0), (64, 65), drawpoints=False),
        # generateLine((testoffset + 256, testoffset + 0), (testoffset + 0, testoffset + 0), (64, 65), drawpoints=False),

        # generateLine((0, 0), (256, 256), (64, 65), drawpoints=False),
        # generateLine((256, 0), (0, 256), (64, 65), drawpoints=False),

        # generateRectBy4Points((0, 0), (128, 0), (128, 128), (0, 128)),
        # generateRectBy4Points((0, 0), (64, 0), (128, 128), (0, 128)),

        # Check Y-directed line
        # generateLine((0, 0), (0, 128), (512, 513), drawpoints=True),
        # generateSafeLine((0, 0), (0, 128), (513, 514)),

        # Check X-directed line
        # generateLine((0, 0), (128, 0), (512, 513), drawpoints=True),
        # generateSafeLine((0, 0), (128, 0), (513, 514)),

        # Check diagonal line
        # generateLine((0, 0), (128, 128), (512, 513), drawpoints=True),

        # generateRectBy4Points(
        #     (testoffset + 64 - 4, testoffset + 64 + 4),
        #     (testoffset + 128 + 4, testoffset + 64 + 4),
        #     (testoffset + 128 + 4, testoffset + 64 - 4),
        #     (testoffset + 64 - 4, testoffset + 64 - 4),
        #     (256, 260)
        # ),
    ]

    with open('generated.map', 'w') as _out:
        _out.write(generateMapFromBrushes(brushes, playerstart))

def prettyNymber(x):
    x = float(x)
    if x == 0: return 0

    if x.is_integer(): return int(x)

    return round(x, 6)

def getPlaneString(x: int, y: int, z: int, distance: int) -> str:
    return f'( {prettyNymber(x)} {prettyNymber(y)} {prettyNymber(z)} {prettyNymber(distance)} ) ( ( 0.125 0 -5 ) ( 0 0.125 57 ) ) "{"textures/alphalabs/a_enwall13c" if TEXTURED else "_none"}" 0 0 0'

def generateBrushDef3(brushes: tuple, comment='// primitive', indent=4) -> str:
    ''' generatesBrushDef3 from 6 *brushes* (normalx, normaly, normalz, distancefromorigin) '''

    if len(brushes) != 6: raise Exception("There must be 6 brushes")

    lines = [
        comment,
        '{',
        '    brushDef3 {',
    ]

    for brush in brushes:
        lines.append('        ' + getPlaneString(*brush))

    lines.append('    }')
    lines.append('}')

    return ' ' * indent + ('\n' + ' ' * indent).join(lines)

def generateSafeLine(v1:tuple, v2:tuple, height:tuple=(0, 8), indent=4, width=8):
    if v1[0] == v2[0]: # vertical
        if v2[1] < v1[1]: v1, v2 = v2, v1
        sizex = width
        sizey = v2[1] - v1[1]# + 8
        return generateRect3d((v1[0], v1[1], height[0]), (sizex, sizey, height[1] - height[0]))
    elif v1[1] == v2[1]: # horizontal
        if v2[0] < v1[0]: v1, v2 = v2, v1
        sizex = v2[0] - v1[0]# + 8
        sizey = width
        return generateRect3d((v1[0], v1[1], height[0]), (sizex, sizey, height[1] - height[0]))
    else: raise Exception('Not a safe line')

def generatePoint(v:tuple, height:float, indent=4, width=4):
    return generateCube(v[0] - width / 2, v[1] - width / 2, height - width / 2, width)

def _firstprart(value, width, compensation): return value / compensation - width / 2
def _secondprart(value, width, compensation): return -(value / compensation + width / 2)

def generateLine(v1:tuple, v2:tuple, height:tuple=(0, 8), indent=4, width=8, drawpoints=False):
    x1, y1 = v1
    x2, y2 = v2

    linevector = Vec2.getDirectionFromPoints(x1, y1, x2, y2)
    dir = linevector.normalize() # line direction
    length = linevector.length() # line length

    compensation = Vec2(*v1).length() or 1 # 0.x normal compensation for length

    px = x1
    py = x1

    # Local space of line (left -> right)
    bottom = (0, 0, -1, height[0])
    top = (0, 0, 1, -height[1])
    left = (*dir.invert().tuple(),          0, linevector.x) 
    right = (*dir.tuple(),                  0, -(length + width / 2))
    front = (*dir.normal().tuple(),         0, -width / 2)      # Half of thickness.
    back = (*dir.normal().invert().tuple(), 0, -(width / 2))    # Half of thickness.

    return generateBrushDef3((bottom, top, left, right, front, back), f'// Line(({x1}, {y1}), ({x2}, {y2}), ({height[0]}, {height[1]}))', indent=indent) + ((generatePoint(v1, height[0]) + generatePoint(v2, height[1])) if drawpoints else '')

def sortPointsTopLeftClockwise(p1:tuple, p2:tuple, p3:tuple, p4:tuple) -> tuple:
    values = set()

    for p in p1, p2, p3, p4:
        for value in p:
            values.add(p)
    
    if len(values) > 4: raise Exception("Isn't a correct rectangular points")

    del values

    minx = min(p1[0], p2[0], p3[0], p4[0])
    miny = min(p1[1], p2[1], p3[1], p4[1])
    maxx = max(p1[1], p2[1], p3[1], p4[1])
    maxy = max(p1[1], p2[1], p3[1], p4[1])

    return ((minx, miny), (maxx, miny), (maxx, maxy), (minx, maxy))

def generateRectBy4Points(p1:tuple, p2:tuple, p3:tuple, p4:tuple, height:tuple=(0, 8), comment=None, indent=4):
    '''
    p1  p2
    p4  p3
    '''

    leftnormal = Vec2.getDirectionFromPoints(*p1, *p4).normalize().rotate(90).tuple()
    rightnormal = Vec2.getDirectionFromPoints(*p3, *p2).normalize().rotate(90).tuple()
    frontnormal = Vec2.getDirectionFromPoints(*p1, *p2).normalize().rotate(90).invert().tuple()
    backnormal = Vec2.getDirectionFromPoints(*p3, *p4).normalize().rotate(90).invert().tuple()

    bottom = (0, 0, -1, height[0])
    top = (0, 0, 1, -height[1])
    left = (*leftnormal, 0, (p1[0] + p4[0]) / 2)
    right = (*rightnormal, 0, -((p2[0] + p3[0]) / 2))
    front = (*frontnormal, 0, (p1[1] + p2[1]) / 2)
    back = (*backnormal, 0, -((p4[1] + p3[1]) / 2))

    return generateBrushDef3((bottom, top, left, right, front, back), comment if comment else f'// RectPoints(...)', indent=indent)

def generateRect3d(position: tuple, size:tuple, indent=4, comment=None, rotation:int=0) -> str:
    x, y, z = position
    width, depth, height = size

    # Move center point to the origin
    x += width / 2
    y += depth / 2

    # Rotate around the origin
    X = Vec2(1.0, 0).rotate(rotation)

    # Compensate rotation
    x, y = Vec2(x, y).rotate(-rotation).tuple()

    # Move back to the base point
    x -= width / 2
    y -= depth / 2

    bottom = (0, 0, -1, z)
    top = (0, 0, 1, -(z + height))
    left = (*X.invert().tuple(), 0, x)
    right = (*X.tuple(), 0, -(x + width))
    front = (*X.rotate(90).invert().tuple(), 0, y)
    back = (*X.rotate(90).tuple(), 0, -(y + depth))

    return generateBrushDef3((bottom, top, left, right, front, back), comment if comment else f'// Rect3d(({x}, {y}, {z}), ({width}, {depth}, {height})', indent=indent)

def generateCube(x, y, z, size, indent=4) -> str:
    return generateRect3d((x, y, z), (size, size, size), indent=indent, comment=f'// Cube({x}, {y}, {z}, {size})')

def generateBox(x, y, z, size, width=8, indent=4) -> str:
    brushes = [
        generateRect3d((x, y, z - width), (size, size, width)), #bottom
        generateRect3d((x, y, z + size), (size, size, width)), #top
        generateRect3d((x - width, y, z), (width, size, size)), #left (player back)
        generateRect3d((size, y, z), (width, size, size)), #right (player front)
        generateRect3d((x, y - width, z), (size, width, size)), #front (player right)
        generateRect3d((x, y + size, z), (size, width, size)), #back (player left)
    ]

    return '\n'.join(brushes)



def generateMapFromBrushes(brushes: list, playerstart: tuple):
    px, py, pz = playerstart
    lines = []
    lines.append('Version 2')
    lines.append('// Map')
    lines.append('{')
    lines.append('    "classname" "worldspawn"')

    for brush in brushes: lines.append(brush)

    lines.append('}')

    lines.append('// PlayerStart')
    lines.append('{')
    lines.append('    "classname" "info_player_start"')
    lines.append('    "name" "info_player_start_1"')
    lines.append(f'    "origin" "{px} {py} {pz}"')
    lines.append('}')

    lines.append('// Player light')
    lines.append('{')
    lines.append('    "classname" "light"')
    lines.append('    "name" "light1"')
    lines.append('    "parallel" "1"')
    lines.append('    "noshadows" "1"')
    lines.append('    "nospecular" "1"')
    lines.append('    "nodiffuse" "1"')
    lines.append('    "falloff" "0.000000"')
    lines.append('    "light_center" "-104 96 -5"')
    lines.append('    "light_radius" "5000 5000 5000"')
    lines.append(f'    "origin" "{px} {py} {pz}"')
    lines.append('}')

    lines.append('// Player light')
    lines.append('{')
    lines.append('    "classname" "light"')
    lines.append('    "name" "light2"')
    lines.append('    "parallel" "1"')
    lines.append('    "noshadows" "1"')
    lines.append('    "nospecular" "1"')
    lines.append('    "nodiffuse" "1"')
    lines.append('    "falloff" "0.000000"')
    lines.append('    "light_center" "104 -96 5"')
    lines.append('    "light_radius" "3000 3000 3000"')
    lines.append(f'    "origin" "{px} {py} {pz}"')
    lines.append('}')

    return '\n'.join(lines)

if __name__ == "__main__":
    main()