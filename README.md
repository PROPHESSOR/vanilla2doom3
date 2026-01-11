# vanilla2doom3

A Python-based converter that transforms Doom WAD (Where's All the Data) files from vanilla Doom games into Doom 3/idTech4 `.map` format files.

## Project Overview

This tool enables playing classic Doom maps in the Doom 3 engine by automatically converting level geometry, sectors, and spatial structures from the original WAD binary format into the idTech4 brush-based map format.

## Purpose

- **Geometry Preservation**: Port fully functional 3D geometry from 2D Doom levels, including all walls, floors, ceilings, and platforms
- **Format Translation**: Convert Doom's sector/linedef/sidedef structure to Doom 3's brushDef3 representation
- **Automated Conversion**: Eliminate manual rebuilding of classic maps in modern tools

## Technical Architecture

### Input Format: Doom WAD Structure
Doom levels are defined through interconnected data structures:
- **Vertices**: 2D coordinate points
- **Linedefs**: Wall segments connecting two vertices, with references to front/back sides
- **Sidedefs**: Wall faces defining textures and target sectors; each linedef has side1 (front) and optionally side2 (back)
- **Sectors**: Volumetric regions defined by their bounding linedefs, with floor/ceiling heights and properties

### Output Format: idTech4 brushDef3
Doom 3 geometry uses **brush primitives** defined by planes:
- Each brush is a convex polyhedron defined by multiple planes
- Planes use format: `(nx, ny, nz, d)` where `(nx, ny, nz)` is the outward-pointing normal
- In idTech4: **negative halfspace = solid (inside brush), positive = void (outside)**
- Normals point **OUTWARD from the brush interior** into the void

### Conversion Pipeline

1. **WAD Parsing** (`wadparser.py`)
   - Reads binary Doom WAD files
   - Extracts vertices, linedefs, sidedefs, sectors
   - Associates sidedefs with sectors (including back-side references for inner structures)
   - Links linedefs to their corresponding sidedefs

2. **Geometry Generation** (`doom2doom3.py`)
   - **Floor/Ceiling Surfaces**: Creates brushes for sector floors and ceilings
   - **Wall Generation**: Generates vertical walls from linedefs
   - **Step Walls**: For height differences between adjacent sectors
   - **Polygon Ordering**: Uses ear-clipping triangulation for complex sector boundaries

3. **Brush Primitives** (`genblock.py`)
   - Generates rectangular brushes (`generateRect3d`) for simple geometries
   - Creates cutting-plane brushes (`generateCutRectSector`) for non-rectangular sector shapes
   - Cuts rectangular surfaces with planes matching polygon edges for proper boundary fitting

4. **Vector Math** (`geometry.py`)
   - 2D and 3D vector operations
   - Plane generation from normal vectors and points
   - Polygon orientation detection

## Key Technical Decisions

### Coordinate System
- Input: Doom units (map-space coordinates)
- Processing: Apply global `OFFSET = 2000` to avoid negative coordinate issues
- Output: idTech4 world coordinates

### Floor/Ceiling Implementation
- Each sector gets two brushes: one for floor (slab below actual floor), one for ceiling (slab above ceiling)
- Slab height: 8 units (sufficient for collision/visibility)
- For non-rectangular sectors: rectangular base with cutting planes at polygon edges
- Fallback: If cutting plane generation fails (complex polygons), use bounding box rectangle

### Wall Generation
- **One-sided linedefs**: Full-height walls from minimum floor to maximum ceiling in adjacent sectors
- **Two-sided linedefs**: Step walls for height differences
  - Lower wall: Only where floor heights differ
  - Upper wall: Only where ceiling heights differ
  - Both walls sealed to prevent leaks

### Complex Sector Handling
- Sectors with interior structures (raised platforms, stairs) may only reference side2 of linedefs
- Solution: Process both side1 and side2 sidedef references to capture all sectors
- Polygon ordering handles complex boundaries through ear-clipping triangulation

## Project Structure

```
vanilla2doom3/
├── doom2doom3.py               # Main converter orchestration
├── genblock.py                 # Brush primitive generation
├── wadparser.py                # WAD binary format parsing
├── geometry.py                 # Vector math utilities
├── ByteTools.py                # Binary file I/O utilities
├── KNOWLEDGE.md                # Technical reference documentation
├── FLOOR_CEILING_FIX.md        # Floor/ceiling geometry fix details
├── README.md                   # This file
├── test_box.map                # Reference box map (original Doom 3)
├── test_boxstack.map           # Reference stacked geometry map
├── demo_mars_city1.map         # Reference complex map
├── compilation.log             # dmap compilation output
└── wad/                        # Input WAD files directory
    ├── VERTEXES.lmp
    ├── LINEDEFS.lmp
    ├── SIDEDEFS.lmp
    ├── SECTORS.lmp
    ├── THINGS.lmp
    └── ...
```

## Known Characteristics

### Limitations
- Complex non-rectangular sector shapes render as their bounding box (with proper walls defining actual boundaries)
- Texture mapping uses a default caulk material (game-compatible fallback)
- No entity conversion (items, monsters, decorations from original map)
- No special sector effects or geometry tricks

### Strengths
- Stable geometry generation (no dmap hangs or invalid brushes)
- Proper sealing with outer bounding box to prevent leaks
- Handles arbitrary polygon shapes through edge-cutting planes
- Supports platforms, stairs, and complex height variations
- Filters degenerate subsectors to prevent backwards triangle warnings

## Known Issues & Fixes

### Floor/Ceiling Geometry Warnings (FIXED)
**Issue**: dmap compiler reported "backwards triangle in input!" warnings (11 instances) on floor/ceiling brushes.

**Root Cause**: Degenerate subsectors with zero or near-zero polygon area (colinear/duplicate vertices) generated invalid cutting planes.

**Fix**: Added polygon area validation to filter subsectors with area < 1.0 square units before brush generation. See [FLOOR_CEILING_FIX.md](FLOOR_CEILING_FIX.md) for detailed analysis.

**Impact**: Eliminates nearly all degenerate geometry. Remaining valid subsectors generate proper floor/ceiling brushes.

## Design Principles for Future Development

1. **idTech4 Plane Convention**: Always remember that normals point OUTWARD and negative halfspace = solid
2. **No Inversion**: Do not invert normals - they should point away from the brush
3. **Stable Over Perfect**: Prefer rectangular approximations over complex geometry that causes compilation issues
4. **Deduplication**: Remove duplicate/mirrored planes before brush generation to prevent dmap warnings
5. **Sector Association**: Both side1 and side2 references need processing for complete geometry coverage
6. **Subsector Validation**: Filter degenerate subsectors (area < 1.0 units²) before processing to prevent invalid geometry

## Reference Maps and Validation

To validate the floor/ceiling generation and brush geometry correctness:
- **test_box.map** - Simple reference box structure showing correct floor/ceiling brush layout
- **test_boxstack.map** - Reference map with stacked geometry (height variations)
- **demo_mars_city1.map** - Another reference map from original Doom 3
- **compilation.log** - dmap output showing compilation warnings and errors for the test map

These reference maps demonstrate proper brushDef3 format and can be compared against generated maps to identify plane orientation and geometry issues.

## TODO

- **Merge Coplanar Adjacent Subsectors**: Add optimization to merge coplanar adjacent subsectors to reduce brush count while maintaining geometric correctness
- **Fine-tune Degenerate Threshold**: Analyze more maps to determine optimal area threshold (currently 1.0 units²)
- **BSP Subsector Quality Analysis**: Track and report statistics on degenerate subsectors per sector

## Future Enhancement Opportunities

- Entity conversion (spawning points, item locations, monster placements)
- Texture mapping preservation
- Special sector effect translation
- Sector-to-entity mapping for secret areas and special regions
- Performance optimization for large maps
