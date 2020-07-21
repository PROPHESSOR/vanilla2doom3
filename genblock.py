#!/usr/bin/python3.7

from geometry import *

TEXTURED = False

def main():
    playerstart = (32, 32, 16)

    brushes = [
        # generateRect3d((-64, -64, -8), (128, 128, 8)), #bottom
        # generateRect3d((-64 - 8, -64, 0), (8, 128, 128)), #left (player back)
        # generateCube(-64, -192, 0, 128), #front (player right)
        # generateCube(64, -64, 0, 128), #right (player front)
        # generateCube(-64, 64, 0, 128), #back (player left)
        # generateRect3d((-64, -64, 128), (128, 128, 8)), #top
        # generateRect3d((256, 256, 256), (128, 128, 1)),

        # generateSafeLine((8, 8), (8, 16)),
        # generateSafeLine((0, 0), (0, 64)),
        # generateSafeLine((0, 0), (64, 0)),

        # generateBox(0, 0, 0, 256),

        # generateLine((0, 0), (32, 32)),

        generateSafeLine((0, 0), (32, 0)),
        generateLine((0, 0), (32, 0), (8, 16)),
        generateLine((0, 0), (32, 32), (16, 24)),
        generateLine((64, 64), (128, 128)),
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

def generateLine(v1:tuple, v2:tuple, height:tuple=(0, 8), indent=4, width=8): # FIXME:
    x1, y1 = v1
    x2, y2 = v2

    dir = Vec2.getDirectionFromPoints(x1, y1, x2, y2)

    bottom = (0, 0, -1, height[0])
    top = (0, 0, 1, -height[1])
    left = (*dir.invert().tuple(), 0, x1)
    right = (*dir.tuple(), 0, -x2)
    front = (*dir.normal().tuple(), 0, y1)
    back = (*dir.normal().invert().tuple(), 0, -y1 - width)

    return generateBrushDef3((bottom, top, left, right, front, back), f'// Line(({x1}, {y1}), ({x2}, {y2}), ({height[0]}, {height[1]}))', indent=indent)

def generateRect3d(position: tuple, size: tuple, indent=4) -> str:
    x, y, z = position
    width, depth, height = size

    bottom = (0, 0, -1, z)
    top = (0, 0, 1, -(z + height))
    left = (-1, 0, 0, x)
    right = (1, 0, 0, -(x + width))
    front = (0, -1, 0, y)
    back = (0, 1, 0, -(y + depth))

    return generateBrushDef3((bottom, top, left, right, front, back), f'// Rect3d(({x}, {y}, {z}), ({width}, {depth}, {height})', indent=indent)

def generateCube(x, y, z, size, indent=4) -> str:
    bottom = (0, 0, -1, z)
    top = (0, 0, 1, -(z + size))
    front = (0, -1, 0, y)
    right = (1, 0, 0, -(x + size)   )
    back = (0, 1, 0, -(y + size))
    left = (-1, 0, 0, x)

    return generateBrushDef3((bottom, top, front, right, back, left), f'// cube({x}, {y}, {z}, {size})', indent=indent)

def generateBox(x, y, z, size, width=8, indent=4) -> str:
    brushes = [
        generateRect3d((x, y, z - width), (size, size, width)), #bottom
        generateRect3d((x - width, y, z), (width, size, size)), #left (player back)
        generateRect3d((x, y - width, z), (size, width, size)), #front (player right)
        generateRect3d((x + size, y, z), (width, size, size)), #right (player front)
        generateRect3d((x, y + size, z), (size, width, size)), #back (player left)
        generateRect3d((x, y, z + size), (size, size, width)), #top
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