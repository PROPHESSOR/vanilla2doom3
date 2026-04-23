# LightingAction Documentation

## Overview

The `LightingAction` implements sector-based ambient lighting for converted Doom 3 maps. It analyzes Doom sector lightlevels (0-255) and places appropriate light entities throughout the map to recreate the original lighting atmosphere.

## Problem Statement

When converting Doom maps to Doom 3, sector lighting information (the `lightlevel` property) is lost because Doom 3 uses point light sources instead of sector-based lighting. Without proper lighting:
- Maps appear completely black in unlit areas
- The atmosphere and visibility from the original map is lost
- Players cannot navigate properly

## Solution Approach

The `LightingAction` solves this by:

1. **One light per subsector**: Places a light at the centroid of each subsector polygon
2. **Height positioning**: Positions lights at mid-height between floor and ceiling
3. **Scaled intensity**: Maps Doom lightlevel (0-255) to appropriate light radius
4. **Performance optimized**: Uses `noshadows` flag to avoid GPU overhead with many lights

## Lighting Strategy Explanation

### Why Subsectors vs Sectors?

Subsectors are the natural convex polygon divisions of the map created by the BSP tree. Using subsectors instead of sectors provides:
- **Even coverage**: Large sectors are broken into smaller regions
- **Better distribution**: Lights follow the actual playable area geometry
- **Natural boundaries**: Each subsector is guaranteed to be convex and well-defined

### Light Intensity Mapping

Doom lightlevel values and their typical meanings:
- `0-63`: Very dark (caves, dark corners)
- `64-127`: Dim (corridors, shadowy areas)
- `128-191`: Normal (most indoor areas, default is 160)
- `192-255`: Bright (outdoor, well-lit areas, tech rooms)

Default mapping to Doom 3 light radius:
- `lightlevel 0` → radius `64` (minimum ambient to avoid pure black)
- `lightlevel 128` → radius `~450` (medium indoor lighting)
- `lightlevel 255` → radius `800` (bright but not overwhelming)

The formula: `radius = minRadius + (lightlevel / 255) × (maxRadius - minRadius)`

### Avoiding Overlighting

Large light radius values can cause overlighting where multiple lights overlap. To prevent this:

1. **Conservative max radius**: Default `maxRadius = 800` is calibrated for typical subsector sizes
2. **No shadows by default**: Reduces visual artifacts from overlapping lights
3. **Intensity multiplier**: Can be reduced (e.g., `0.7`) if maps still appear too bright
4. **Per-sector filtering**: Use `minLightLevel` to skip intentionally dark sectors

## Configuration Options

### Basic Configuration

```typescript
new LightingAction({
  minRadius: 64,          // Minimum light radius (for lightlevel 0)
  maxRadius: 800,         // Maximum light radius (for lightlevel 255)
  intensityMultiplier: 1.0, // Overall brightness multiplier
})
```

### All Options

```typescript
interface LightingActionOptions {
  // Radius range
  minRadius?: number;           // Default: 64
  maxRadius?: number;           // Default: 800

  // Appearance
  color?: [number, number, number]; // RGB 0-1, Default: [1, 0.95, 0.9] (warm white)

  // Performance
  noShadows?: boolean;          // Default: true (recommended)

  // Fine-tuning
  intensityMultiplier?: number; // Default: 1.0
  heightOffset?: number;        // Vertical offset in Doom units, Default: 0
  minLightLevel?: number;       // Skip sectors below this lightlevel, Default: 0

  // Advanced
  useQuadraticFalloff?: boolean; // Use light_center for better falloff, Default: false
}
```

## Usage Examples

### Example 1: Default Configuration

Simple setup with defaults - good for most maps:

```typescript
const processor = new MapProcessor([
  new LightingAction(),
]);
```

### Example 2: Dimmer Lighting

For maps that feel too bright:

```typescript
new LightingAction({
  intensityMultiplier: 0.7,  // Reduce all lights to 70% intensity
  maxRadius: 600,            // Lower maximum radius
})
```

### Example 3: Preserve Dark Areas

Keep intentionally dark areas dark (horror maps):

```typescript
new LightingAction({
  minLightLevel: 32,         // Only light sectors with lightlevel >= 32
  minRadius: 32,             // Very dim minimum light
  intensityMultiplier: 0.8,  // Overall dimmer
})
```

### Example 4: Bright Tech Maps

For tech base style maps that should be well-lit:

```typescript
new LightingAction({
  minRadius: 128,            // Higher minimum for ambient fill
  maxRadius: 1024,           // Brighter maximum
  color: [0.9, 0.95, 1.0],   // Cool white/blue tint
})
```

### Example 5: Performance Optimized

For very large maps with many subsectors:

```typescript
new LightingAction({
  minLightLevel: 64,         // Skip dark sectors entirely
  noShadows: true,           // Essential for performance
  maxRadius: 600,            // Smaller radius = less overlap
})
```

## How It Works (Technical)

### Phase 1: Preprocess

During `preprocess(map)`:
1. Iterate through all subsectors
2. For each subsector:
   - Get the associated sector and its lightlevel
   - Calculate polygon centroid from subsector vertices
   - Calculate light radius based on lightlevel
   - Store light data in `subsector.metadata.lighting`
3. Store reference to map for postprocess phase

### Phase 2: Postprocess

During `postprocess(doom3Map)`:
1. Retrieve stored lighting data from map metadata
2. For each stored light:
   - Convert Doom coordinates to Doom 3 space using `mapX/mapY/mapZ`
   - Create light entity with calculated properties
   - Add to doom3Map

### Generated Light Entity Format

```
{
  "classname" "light"
  "name" "light_sector_5_0"
  "origin" "256.0 -384.0 96.0"
  "light_radius" "450 450 450"
  "_color" "1 0.95 0.9"
  "noshadows" "1"
}
```

## Performance Considerations

### Light Count

Each subsector gets one light. For reference:
- Small map (E1M1): ~100-200 lights
- Medium map: ~300-500 lights
- Large map: ~500-1000+ lights

Doom 3 can handle hundreds of lights if `noshadows` is used.

### Shadow Performance

- **With shadows**: Each light calculates shadow maps every frame
- **Without shadows**: Lights use simple additive blending (much faster)
- **Recommendation**: Always use `noshadows: true` for sector lighting

### Alternatives for Better Performance

1. **Manual light placement**: Instead of automatic per-subsector lighting, manually place fewer strategic lights
2. **Light zones**: Group multiple subsectors and place one light per group
3. **Hybrid approach**: Use LightingAction for main areas, manual lights for detail

## Troubleshooting

### Map is too bright

```typescript
new LightingAction({
  intensityMultiplier: 0.6,  // Reduce to 60%
  maxRadius: 600,            // Lower maximum
})
```

### Map is too dark

```typescript
new LightingAction({
  intensityMultiplier: 1.3,  // Increase to 130%
  minRadius: 96,             // Higher minimum
})
```

### Dark sectors are completely black

```typescript
new LightingAction({
  minRadius: 128,            // Increase minimum ambient
  // Don't set minLightLevel - light all sectors
})
```

### Performance issues / low FPS

```typescript
new LightingAction({
  minLightLevel: 80,         // Skip darker sectors
  noShadows: true,           // Essential
  maxRadius: 512,            // Smaller radius
})
```

### Lights look flat / no depth

```typescript
new LightingAction({
  noShadows: false,          // Enable shadows (performance cost!)
  useQuadraticFalloff: true, // Better falloff curve
})
```

## Future Improvements

Possible enhancements:

1. **Grouped lighting**: Combine nearby subsectors to reduce light count
2. **LOD system**: Distant sectors use simpler/fewer lights
3. **Light probes**: Use ambient cubes or light probes for fill lighting
4. **Sky lighting**: Special handling for outdoor sectors with sky
5. **Dynamic range**: Compress lightlevel range to avoid extremes

## Doom 3 Ambient Lighting Note

You asked about using "ambient lights" in Doom 3. Standard Doom 3 doesn't have true ambient lighting in the modern sense (like Unity's ambient light). Doom 3 lighting options:

1. **Point lights** (what we use): `light` entity with radius
2. **Projected lights**: `light` with texture projection
3. **Fog lights**: `light` with fog parameters
4. **Material ambient**: Set on materials (not practical for conversion)

For ambient fill, the best approach is what we're doing: many small `noshadows` point lights distributed throughout the map. This simulates ambient lighting while maintaining the Doom 3 visual style.

## See Also

- [ThingAction.ts](./ThingAction.ts) - Entity placement (includes some decorative lights)
- [DoorAction.ts](./DoorAction.ts) - Door functionality
- [Doom 3 Editing Reference](https://modwiki.dhewm3.org/) - Official Doom 3 editing docs
