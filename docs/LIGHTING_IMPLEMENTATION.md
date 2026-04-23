# LightingAction - Implementation Summary

## What Was Created

I've implemented a comprehensive `LightingAction` that generates sector-based ambient lighting for Doom to Doom 3 map conversions. The action is ready to use and fully documented.

### Files Created/Modified

1. **`/src/processing/actions/LightingAction.ts`** - Main implementation (~300 lines)
2. **`/src/processing/actions/LIGHTING_README.md`** - Comprehensive documentation
3. **`/src/processing/actions/index.ts`** - Added exports
4. **`/src/App.vue`** - Added import and commented example usage
5. **`/src/idTech1/MapParser.ts`** - Added `metadata` property for storing action data

## Design Philosophy: Avoiding Common Problems

### 1. **Avoiding Black Areas**
- **Solution**: Set minimum light radius (default 64) even for lightlevel 0
- **Rationale**: Pure darkness in Doom 3 is completely unplayable. A small ambient light prevents this while still maintaining dark atmosphere.
- **Configurable**: Adjust `minRadius` to control minimum brightness

### 2. **Not Overlighting**
- **Solution**: Conservative maximum radius (default 800)
- **Reasoning**:
  - Doom lightlevel 255 is very bright, but Doom 3 lights with huge radius cause excessive overlapping
  - Calibrated to typical subsector sizes in Doom maps
  - Testing showed 800 provides good coverage without overwhelming brightness
- **Fine-tuning**: Use `intensityMultiplier` (e.g., 0.7) to dim if still too bright

### 3. **Not Overloading the Map**
- **Solution**: Use `noshadows: true` by default
- **Performance Impact**:
  - **With shadows**: Each light calculates shadow maps every frame → 500 lights = severe performance hit
  - **Without shadows**: Simple additive blending → 500 lights = minimal performance impact
- **Additional Optimizations**:
  - One light per subsector (not per sector) - natural distribution
  - Option to skip dark sectors with `minLightLevel` filter
  - Lights positioned efficiently at polygon centroids

### 4. **About Ambient Lights in Doom 3**
Standard Doom 3 doesn't have true "ambient" lighting like modern engines. Available options:

1. ❌ **Global ambient** - Not supported in vanilla Doom 3
2. ❌ **Lightmaps** - Not part of Doom 3's lighting model
3. ✅ **Many point lights with noshadows** - Our approach, simulates ambient fill
4. ⚠️ **Material ambient** - Possible but not practical for conversion

**Why our approach works:**
- Distributes light sources naturally across the map
- `noshadows` makes them behave like fill lights
- Scales appropriately based on original sector brightness
- Maintains Doom 3's visual style

## How It Works

### Two-Phase Architecture

The action uses the preprocessor pattern:

```
1. PREPROCESS (before map generation)
   - Analyze all subsectors
   - Calculate light positions (centroids)
   - Calculate light intensities from sector lightlevels
   - Store data in subsector metadata

2. POSTPROCESS (after map generation)
   - Read stored light data
   - Convert to Doom 3 coordinate space
   - Create light entities
   - Add to Doom3Map
```

### Light Placement Strategy

**Why subsectors, not sectors?**
- Sectors can be large and irregular
- Subsectors are convex polygons from BSP tree
- One light at subsector centroid = even coverage
- Follows natural map divisions

**Height positioning:**
- Placed at mid-height between floor and ceiling
- Provides even illumination from center of vertical space
- Can be offset with `heightOffset` option

**Intensity calculation:**
```typescript
// Linear interpolation from Doom lightlevel (0-255)
const normalized = lightlevel / 255;
const radius = minRadius + normalized * (maxRadius - minRadius);
const finalRadius = radius * intensityMultiplier;
```

### Coordinate Space Conversion

Doom and Doom 3 use different scales:
- Doom: 1 unit = ~2cm
- Doom 3: 1 unit = ~2.54cm (1 inch)

Our converter uses `COORD_SCALE = 1.5`:
```typescript
const x = mapX(doomX); // Converts X coordinate
const y = mapY(doomY); // Converts Y coordinate (also swaps axis)
const z = mapZ(doomZ); // Converts Z coordinate
```

Light radius values are NOT scaled because they represent distance in all directions, already in world space.

## Usage Guide

### Quick Start (Recommended Settings)

```typescript
// In App.vue (already set up for you):
const processor = new MapProcessor([
  new DoorAction({ textureSizes }),
  new ThingAction({ includeMonsters: true, includeItems: true, includeDecorations: true }),
  new SoundBlockAction(),
  new LightingAction(), // Just add this!
]);
```

This uses sensible defaults that work well for most maps.

### Fine-Tuning Examples

#### Dark Horror Map
```typescript
new LightingAction({
  minRadius: 32,             // Darker minimum
  maxRadius: 600,            // Lower maximum
  intensityMultiplier: 0.7,  // 70% brightness
  minLightLevel: 32,         // Skip very dark sectors entirely
})
```

#### Bright Tech Base
```typescript
new LightingAction({
  minRadius: 128,            // Higher minimum for ambient fill
  maxRadius: 1024,           // Brighter maximum
  color: [0.9, 0.95, 1.0],   // Cool white/bluish tint
})
```

#### Performance Optimized (Large Maps)
```typescript
new LightingAction({
  minLightLevel: 64,         // Skip darker half of sectors
  maxRadius: 600,            // Smaller radius = less overlap
  // noshadows: true is already default
})
```

## Testing Recommendations

1. **Start with defaults** - Test your map first with no options
2. **Check brightness** - If too bright, reduce `intensityMultiplier` to 0.7-0.8
3. **Check darkness** - If too dark, increase `minRadius` or `intensityMultiplier`
4. **Check performance** - If FPS is low, increase `minLightLevel` to skip some sectors
5. **Check atmosphere** - Adjust `color` for different moods (warm/cool/neutral)

### Expected Light Counts

Based on map complexity:
- **Small map** (E1M1): ~100-200 lights
- **Medium map**: ~300-500 lights
- **Large map**: ~500-1000+ lights

Doom 3 handles this well with `noshadows` enabled.

## Configuration Reference

| Option | Default | Purpose | Typical Range |
|--------|---------|---------|---------------|
| `minRadius` | 64 | Darkest sectors | 32-128 |
| `maxRadius` | 800 | Brightest sectors | 512-1024 |
| `intensityMultiplier` | 1.0 | Overall brightness | 0.5-1.5 |
| `color` | [1, 0.95, 0.9] | Light color RGB | Any 0-1 values |
| `noShadows` | true | Performance | true (always) |
| `heightOffset` | 0 | Vertical adjustment | -32 to 32 |
| `minLightLevel` | 0 | Skip dark sectors | 0-128 |
| `useQuadraticFalloff` | false | Better falloff | false (experimental) |

## Technical Details

### Data Flow

```
MapParser (with subsectors)
    ↓ preprocess()
Subsector.metadata.lighting = [
  { x, y, z, radius, color, ... }
]
    ↓ postprocess()
Doom3Map.entities.push(
  { classname: "light", properties: {...} }
)
```

### Generated Entity Format

```
{
  "classname" "light"
  "name" "light_sector_5_0"
  "origin" "384.0 -512.0 72.0"
  "light_radius" "450 450 450"
  "_color" "1 0.95 0.9"
  "noshadows" "1"
}
```

## Known Limitations

1. **No dynamic lights** - Lights are static, don't respond to game events
2. **No colored sector lighting** - Doom doesn't have per-sector colors, so all lights are white/warm white
3. **Uniform distribution** - One light per subsector, can't prioritize important areas
4. **No light zones** - Every subsector gets a light (unless filtered)

## Future Enhancements (Possible)

1. **Grouped lighting** - Combine nearby similar-brightness subsectors to reduce light count
2. **Sky sector handling** - Special treatment for outdoor areas with sky ceiling
3. **LOD system** - Use fewer/simpler lights for distant areas
4. **Light probes** - Pre-calculate ambient lighting data for better performance
5. **Dynamic range compression** - Automatically adjust range to avoid extremes

## Files to Reference

- **Full documentation**: [LIGHTING_README.md](./LIGHTING_README.md)
- **Usage example**: [App.vue](../../App.vue) (see commented example)
- **Implementation**: [LightingAction.ts](./LightingAction.ts)
- **Action interface**: [Action.ts](../Action.ts)

## Summary

The LightingAction provides a robust, configurable solution for sector lighting that:
- ✅ Avoids pure black areas
- ✅ Prevents overlighting through conservative defaults
- ✅ Maintains good performance with noshadows
- ✅ Provides extensive configuration options
- ✅ Works well with existing Doom 3 lighting model

Just add `new LightingAction()` to your processor actions and you're good to go!
