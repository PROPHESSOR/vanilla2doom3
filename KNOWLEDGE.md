# idTech 4 (Doom 3) Map Format Knowledge

## Brush Geometry Fundamentals

### Plane Equation Format
- Planes defined as: `(nx, ny, nz, d)` where `nx*x + ny*y + nz*z + d = 0`
- **Negative halfspace (result < 0) = SOLID (inside brush)**
- **Positive halfspace (result > 0) = VOID (outside brush)**
- **Normals MUST point OUTWARD** from brush interior toward void

### Correct Slab (Floor/Ceiling) Generation
For a horizontal slab from z=Z to z=Z+H:
- **Bottom plane**: `(0, 0, -1, Z)` - normal points DOWN (away from solid above)
- **Top plane**: `(0, 0, 1, -(Z+H))` - normal points UP (away from solid below)
- **These are NOT mirrored** - they have opposite normals AND different d-values

Example from test_box.map (z=256 to z=272, height=16):
```
( 0 0 -1 256 )  → 0x + 0y + (-1)z + 256 = 0  → z = 256 (bottom)
( 0 0 1 -272 )  → 0x + 0y + 1z + (-272) = 0  → z = 272 (top)
```

### Mirrored Planes Error
When dmap reports "mirrored plane" warnings, it means:
- Two planes with **opposite normals** at the **SAME geometric location**
- Example: `(0,0,-1,40)` and `(0,0,1,-40)` both define z=40
- This is geometrically impossible - the planes contradict each other
- Causes: black rendering, compilation errors, missing geometry

### Cutting Planes for Polygonal Slabs
When creating a slab that matches a polygon boundary:
1. Use bottom/top planes for height (as above)
2. For each polygon edge, create a vertical cutting plane:
   - Calculate edge vector: `(ex, ey) = (x2-x1, y2-y1)`
   - Calculate outward normal perpendicular to edge
   - For CCW winding: `(nx, ny) = (-ey, ex)` (rotate 90° CCW)
   - For CW winding: `(nx, ny) = (ey, -ex)` (rotate 90° CW)
   - Verify normal points away from polygon centroid
   - Create plane: `plane_from_normal_point((nx, ny, 0), (x1, y1, z))`
   - **CRITICAL**: Use bottom Z coordinate for all cutting planes, not top

### Plane Deduplication
- Round normals to 5 decimal places, d-values to 1 decimal place
- Create key: `(round(nx,5), round(ny,5), round(nz,5), round(d,1))`
- Track in set to avoid duplicate planes
- **Do NOT deduplicate bottom/top planes against each other** - they should both exist!
- **CRITICAL**: Deduplication MUST be enabled for cutting planes - without it, polygons with collinear edges will generate dozens of duplicate planes, causing "duplicate plane" warnings in dmap compilation
- Add bottom/top plane keys to seen_planes set BEFORE processing cutting planes to prevent them from being duplicated

## Doom WAD Format

### Binary Lump Structures

**VERTEXES.lmp**: 4 bytes per vertex
- int16 x, int16 y (2D coordinates only)

**LINEDEFS.lmp**: 14 bytes per linedef
- uint16 v1, v2 (vertex indices)
- uint16 flags, type, tag
- uint16 side1, side2 (sidedef indices, 0xFFFF = none)

**SIDEDEFS.lmp**: 30 bytes per sidedef
- int16 offsetX, offsetY
- char[8] texUpper, texLower, texMiddle
- uint16 sector

**SECTORS.lmp**: 26 bytes per sector
- int16 heightFloor, heightCeil
- char[8] texFloor, texCeil
- int16 lightLevel
- uint16 special, tag

**SEGS.lmp**: 12 bytes per seg (BSP segment)
- uint16 startVertex, endVertex (vertex indices)
- int16 angle (BAMS angle: 0-65535 = 0-360°)
- uint16 linedef (linedef index)
- uint16 direction (0=same as linedef, 1=opposite)
- uint16 offset (distance along linedef)

**SSECTORS.lmp**: 4 bytes per subsector (BSP leaf)
- uint16 segCount (number of segs in this subsector)
- uint16 firstSeg (index of first seg)

### BSP Subsector Usage
- Subsectors are **pre-computed convex decompositions** of sectors
- Each subsector is guaranteed to be convex (by BSP node builder)
- Some subsectors are degenerate (<3 vertices) - these are rendering tricks and should be filtered
- Use subsectors to avoid:
  - Manual polygon ordering (which fails on complex/concave sectors)
  - Bounding box + cutting plane approach (less accurate)
  - Triangulation (generates more brushes than needed)

### Critical Bug Fix: Mirrored Planes

### Problem
When dmap compiled the generated map, it reported "mirrored plane" warnings on 25+ brushes. Investigation showed that these brushes had two Z-planes with opposite normals at the same geometric location:
- Example: `(0,0,-1,40)` and `(0,0,1,-40)` both define z=40
- This creates an impossible geometric contradiction
- Caused black/missing floor and ceiling rendering

### Root Cause
The mirrored plane bug was **NOT** in the plane generation logic itself (generateCutRectSector was creating correct planes). Instead, it was caused by brushes with **zero height** being generated elsewhere in the code (specifically in generateLine -> generateRect3d).

When invalid brushes with height=0 were written to the map file, they somehow corrupted or interfered with other brushes in the file, causing the appearance of mirrored planes in what should have been valid brushes.

### Solution
Added validation in generateRect3d to catch and skip zero-height brushes:
```python
if width <= 0 or depth <= 0 or height <= 0:
    print(f"WARNING: generateRect3d called with invalid size, skipping", file=sys.stderr)
    return ""  # Return empty string instead of raising exception
```

This allows partial map generation to continue while skipping invalid brushes, and **completely eliminated** all 25 mirrored plane errors.

### Key Insight
File-level corruption from invalid brushes can cause errors in seemingly unrelated brushes. Always validate ALL brush parameters, not just the one you're working on. Map file format is sensitive to malformed brushes.

## Critical Bug Fix: Mirrored Planes

### Problem
When dmap compiled the generated map, it reported "mirrored plane" warnings on 25+ brushes. Investigation showed that these brushes had two Z-planes with opposite normals at the same geometric location:
- Example: `(0,0,-1,40)` and `(0,0,1,-40)` both define z=40
- This creates an impossible geometric contradiction
- Caused black/missing floor and ceiling rendering

### Root Cause
The mirrored plane bug was **NOT** in the plane generation logic itself (generateCutRectSector was creating correct planes). Instead, it was caused by brushes with **zero height** being generated elsewhere in the code (specifically in generateLine -> generateRect3d).

When invalid brushes with height=0 were written to the map file, they somehow corrupted or interfered with other brushes in the file, causing the appearance of mirrored planes in what should have been valid brushes.

### Solution
Added validation in generateRect3d to catch and skip zero-height brushes:
```python
if width <= 0 or depth <= 0 or height <= 0:
    print(f"WARNING: generateRect3d called with invalid size, skipping", file=sys.stderr)
    return ""  # Return empty string instead of raising exception
```

This allows partial map generation to continue while skipping invalid brushes, and **completely eliminated** all 25 mirrored plane errors.

### Key Insight
File-level corruption from invalid brushes can cause errors in seemingly unrelated brushes. Always validate ALL brush parameters, not just the one you're working on. Map file format is sensitive to malformed brushes.

## Common Pitfalls
1. **Zero-length normals**: Check edge length before normalizing
2. **Degenerate polygons**: Filter subsectors with <3 unique vertices
3. **Wrong winding order**: Calculate signed area to detect CCW vs CW
4. **Normals pointing inward**: Use centroid dot product test to verify direction
5. **Height = 0**: Always validate height > 0 before creating brush - **CRITICAL**: Zero-height brushes can corrupt the map file and cause seemingly unrelated brushes to have mirrored planes!
6. **Mirrored planes**: Ensure cutting planes don't duplicate Z-planes at same coordinate
7. **Invalid dimensions in generateRect3d**: Always validate width > 0, depth > 0, height > 0 - return empty string instead of raising exception to allow partial map generation

## idTech 4 Map File Structure

### File Format
```
Version 2
// entity 0
{
"classname" "worldspawn"
"property" "value"
// primitive N
{
 brushDef3
 {
  ( nx ny nz d ) ( ( s_x s_y s_offset ) ( t_x t_y t_offset ) ) "texture/path" content_flags surface_flags value
  ...
 }
}
}
// entity 1
{
"classname" "entity_type"
"name" "entity_name"
"origin" "x y z"
...
}
```

### Texture Coordinates
- Each plane has 2D texture coordinate system (s, t)
- Format: `( ( s_x s_y s_offset ) ( t_x t_y t_offset ) )`
- Can be set to identity: `( ( 0.125 0 0 ) ( 0 0.125 0 ) )`
- Scale affects texture size (0.125 = 1/8 scale)

### Common Texture Paths
- `textures/base_floor/sflpanel6` - floor textures
- `textures/base_wall/lfwall27d` - wall textures
- `textures/common/caulk` - invisible no-draw surface
- `textures/common/clip` - player collision

## Coordinate System
- X-axis: horizontal (typically east-west)
- Y-axis: horizontal (typically north-south)
- Z-axis: vertical (up is positive)
- Doom uses 2D coordinates (x,y), z is stored per sector
- idTech 4 uses full 3D coordinates (x,y,z)

### Doom Sector Heights
- `heightFloor`: The Z coordinate of the TOP surface of the floor
- `heightCeil`: The Z coordinate of the BOTTOM surface of the ceiling
- Players walk ON the floor (at z=heightFloor)
- Players' heads are blocked BY the ceiling (at z=heightCeil)

### Converting Doom Heights to idTech 4 Slabs
For visual consistency, create 8-unit thick slabs:
- **Floor slab**: Bottom at `heightFloor - 8`, Top at `heightFloor`
  - Creates solid geometry below the walking surface
  - Players walk on the top surface of this slab
- **Ceiling slab**: Bottom at `heightCeil`, Top at `heightCeil + 8`
  - Creates solid geometry above the ceiling surface
  - Players are blocked by the bottom surface of this slab

Example: Doom sector with floor=56, ceiling=128:
- Floor brush: z=48 to z=56 (8 units thick, top at walking height)
- Ceiling brush: z=128 to z=136 (8 units thick, bottom at head-bump height)
- Playable space: z=56 to z=128 (72 units of vertical clearance)

## Degenerate Subsector Handling

### Problem
BSP subsectors sometimes produce degenerate polygons with:
- **Zero or near-zero area** (collinear vertices, duplicates, or self-intersecting)
- **Very small positive area** (numerical precision issues)
- Both CCW and CW winding orders

These degenerate subsectors cause cutting plane generation to fail or produce invalid geometry, resulting in "backwards triangle" warnings during dmap compilation.

### Solution
Filter out subsectors with area < 1.0 square units before calling `generateCutRectSector`:

```python
subsector_area = polygon_area(subsector_poly)
if abs(subsector_area) < 1.0:
    print(f"WARNING: degenerate polygon (area={subsector_area:.1f}), skipping")
    continue
```

This eliminates nearly all degenerate geometry without affecting valid sectors. Other non-degenerate subsectors in the same sector still generate valid brushes.

### Testing Impact
- Example: Sector 17 had 7 degenerate subsectors that were filtered out
- Remaining valid subsectors generate proper floor/ceiling brushes
- Reduces "backwards triangle" warnings during compilation

## Conversion Strategy: Doom → idTech 4
1. Parse all WAD lumps (VERTEXES, SECTORS, SEGS, SSECTORS, etc.)
2. Group subsectors by parent sector (trace through SEGS → LINEDEFS → SIDEDEFS → SECTORS)
3. For each sector:
   - Filter degenerate subsectors (area < 1.0 units²)
   - Generate floor brushes from remaining subsector polygons at sector floor height
   - Generate ceiling brushes from remaining subsector polygons at sector ceiling height
4. Add global offset (e.g., +2000 on x,y) to avoid negative coordinates
5. Use appropriate slab thickness (e.g., 8 units)

## Future Optimization Opportunities
1. **Merge coplanar adjacent subsectors**: Reduce brush count by combining subsectors in same sector
2. **Wall generation**: Currently not implemented - walls from LINEDEFS with non-solid neighbors
3. **Texture mapping**: Currently using default textures - could map Doom textures to idTech 4 equivalents
4. **Thing placement**: Convert Doom THINGS to idTech 4 entities
5. **Lighting**: Convert Doom sector light levels to idTech 4 lights
6. **Special effects**: Convert Doom linedef/sector specials to idTech 4 scripts
