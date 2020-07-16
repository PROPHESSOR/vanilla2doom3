from ByteTools import ByteTools

def main():
    from pprint import pprint
    entities = parseSectors()
    pprint(entities)

def parseLines():
    vertex_stream = open('wad/VERTEXES.lmp', 'rb')
    linedef_stream = open('wad/LINEDEFS.lmp', 'rb')
    sidedef_stream = open('wad/SIDEDEFS.lmp', 'rb')
    sector_stream = open('wad/SECTORS.lmp', 'rb')

    vert = ByteTools(vertex_stream)
    lined = ByteTools(linedef_stream)
    sided = ByteTools(sidedef_stream)
    sect = ByteTools(sector_stream)

    vertices = []
    linedefs = []
    sidedefs = []
    sectors = []

    while True:
        try:
            vertices.append((vert.parseInt16(), vert.parseInt16()))
        except IOError:
            break

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

    while True:
        try:
            sidedefs.append({
                'offsetX': sided.parseInt16(),
                'offsetY': sided.parseInt16(),
                'texUpper': sided.parseASCIIString(8).rstrip('\x00'),
                'texLower': sided.parseASCIIString(8).rstrip('\x00'),
                'texMiddle': sided.parseASCIIString(8).rstrip('\x00'),
                'sector': sided.parseUInt16(),
            })
        except IOError:
            break

    while True:
        try:
            sectors.append({
                'heightFloor': sect.parseInt16(),
                'heightCeil': sect.parseInt16(),
                'texFloor': sect.parseASCIIString(8).rstrip('\x00'),
                'texCeil': sect.parseASCIIString(8).rstrip('\x00'),
                'lightLevel': sect.parseInt16(),
                'special': sect.parseUInt16(),
                'tag': sect.parseUInt16(),
            })
        except IOError:
            break

    lines = []

    for linedef in linedefs:
        sector = sectors[sidedefs[linedef['side1']]['sector']]
        lines.append((vertices[linedef['v1']], vertices[linedef['v2']], (sector['heightFloor'], sector['heightCeil'])))

    return lines

def parseSectors() -> list:
    ''' returns [((x1, y1), (x2, y2), (floor, ceil))] '''
    vertex_stream = open('wad/VERTEXES.lmp', 'rb')
    linedef_stream = open('wad/LINEDEFS.lmp', 'rb')
    sidedef_stream = open('wad/SIDEDEFS.lmp', 'rb')
    sector_stream = open('wad/SECTORS.lmp', 'rb')

    vert = ByteTools(vertex_stream)
    lined = ByteTools(linedef_stream)
    sided = ByteTools(sidedef_stream)
    sect = ByteTools(sector_stream)

    vertices = []
    linedefs = []
    sidedefs = []
    sectors = []

    while True:
        try:
            vertices.append((vert.parseInt16(), vert.parseInt16()))
        except IOError:
            break

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

    while True:
        try:
            sidedefs.append({
                'offsetX': sided.parseInt16(),
                'offsetY': sided.parseInt16(),
                'texUpper': sided.parseASCIIString(8).rstrip('\x00'),
                'texLower': sided.parseASCIIString(8).rstrip('\x00'),
                'texMiddle': sided.parseASCIIString(8).rstrip('\x00'),
                'sector': sided.parseUInt16(),
            })
        except IOError:
            break

    while True:
        try:
            sectors.append({
                'heightFloor': sect.parseInt16(),
                'heightCeil': sect.parseInt16(),
                'texFloor': sect.parseASCIIString(8).rstrip('\x00'),
                'texCeil': sect.parseASCIIString(8).rstrip('\x00'),
                'lightLevel': sect.parseInt16(),
                'special': sect.parseUInt16(),
                'tag': sect.parseUInt16(),
            })
        except IOError:
            break

    for linedef in linedefs:
        linedef['vertex1'] = vertices[linedef['v1']]
        linedef['vertex2'] = vertices[linedef['v2']]
        sidedef = sidedefs[linedef['side1']]

        if not 'linedefs' in sidedef:
            sidedef['linedefs'] = []

        sidedef['linedefs'].append(linedef)

    for sidedef in sidedefs:
        sector = sectors[sidedef['sector']]

        if not 'sidedefs' in sector:
            sector['sidedefs'] = []

        sector['sidedefs'].append(sidedef)

    return sectors

if __name__ == "__main__":
    main()