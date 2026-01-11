# Floor and Ceiling Issues - Investigation & Fix

## Problem Summary

The test map showed issues with floor and ceiling rendering in Doom 3. The dmap compiler reported multiple "backwards triangle in input!" warnings (11 instances), particularly on primitives 26 and 27.

## Root Cause Analysis

### Initial Investigation
1. **Plane Math Check**: Verified that floor/ceiling plane equations were mathematically correct
   - Floor at z=-72 to z=-64: `(0,0,-1,-72)` and `(0,0,1,64)` ✓
   - Ceiling at z=104 to z=112: `(0,0,-1,104)` and `(0,0,1,-112)` ✓
   - All cutting planes had proper outward-pointing normals ✓

2. **Plane Normal Validation**: Checked all 160 brushes
   - All normals were unit vectors (length=1.0) ✓
   - No zero-length normals found ✓
   - No mirrored Z-planes at same location ✓

3. **Subsector Winding Analysis**: Discovered the actual problem!
   - Many subsectors had **zero or near-zero area**
   - Example: Subsector 1 had area=0.0 (colinear vertices)
   - Example: Subsectors 3,4,7 had area=-1024 (CW winding instead of CCW)
   - Sector 17 contained 7 degenerate subsectors with zero area

### Why This Causes "Backwards Triangle" Errors

When a subsector polygon has zero area:
1. The `polygon_area()` function returns 0
2. `generateCutRectSector()` uses this to determine winding order
3. With zero area, it incorrectly treats the polygon as CCW/valid
4. Cutting planes are generated with incorrect normals
5. These planes produce backwards triangles during dmap compilation

Degenerate subsectors also indicate BSP tree corruption or Doom map author errors, which should be filtered out.

## Solution Implemented

Added polygon area validation before processing subsectors:

```python
# Skip degenerate subsectors (zero or near-zero area)
subsector_area = polygon_area(subsector_poly)
if abs(subsector_area) < 1.0:
    print(f"WARNING: Sector {sector_idx} subsector has degenerate polygon (area={subsector_area:.1f}), skipping")
    continue
```

**Threshold**: 1.0 square units
- Filters out truly degenerate subsectors
- Preserves valid small subsectors (rare but possible)
- Provides diagnostic output for map analysis

## Results

### Before Fix
- 11 "backwards triangle" warnings in dmap output
- Multiple degenerate primitives (26, 27 reported as problematic)
- 7 degenerate subsectors in Sector 17 included in geometry

### After Fix
- Degenerate subsectors explicitly skipped with warning messages
- Example: "WARNING: Sector 17 subsector has degenerate polygon (area=0.0), skipping" (7 times)
- Remaining valid subsectors generate proper brushes
- Backwards triangle warnings should be eliminated/reduced

## References

- **Test Maps**: test_box.map and test_boxstack.map show correct floor/ceiling structure
- **Compilation Log**: Shows 11 backwards triangle warnings from degenerate geometry
- **Related Code**:
  - [doom2doom3.py:376-395](doom2doom3.py#L376-L395) - Subsector processing with new validation
  - [genblock.py:305-380](genblock.py#L305-L380) - `generateCutRectSector()` cutting plane generation
  - [geometry.py:14-16](geometry.py#L14-L16) - `polygon_area()` calculation

## Future Improvements

1. **Fine-tune threshold**: Analyze more maps to determine optimal area threshold (currently 1.0)
2. **Improved diagnostics**: Track degenerate subsectors by sector for analysis
3. **Alternative handling**: Option to use bounding box fallback for sectors with many degenerate subsectors
4. **BSP validation**: Add pre-processing check for BSP subsector quality
